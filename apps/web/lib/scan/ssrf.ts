import { promises as dns } from 'node:dns'
import { BlockList, isIP } from 'node:net'

// ── SSRF guard ───────────────────────────────────────────────────────────────
// Everything a user-supplied URL has to pass before we're allowed to fetch it.
// Rejects loopback/private/link-local/CGNAT ranges, cloud metadata IPs, and
// internal hostnames — then resolves the host and re-checks every resolved
// address, so a public name that maps to a private IP is caught too. Callers
// re-run guardUrl on every redirect hop to close the redirect-SSRF hole.

const MAX_URL_LENGTH = 2048

// Thrown for anything the client can fix (bad/blocked/unreachable/non-html URL).
// `message` is always safe to show the user — never a raw internal error.
export class ScanError extends Error {
  readonly status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'ScanError'
    this.status = status
  }
}

const BLOCKED_MESSAGE =
  "That URL points to a private, local, or internal address, so it can't be scanned."

// Build the blocklist once. BlockList handles IPv4, IPv6, and IPv4-mapped IPv6.
const buildBlockList = (): BlockList => {
  const b = new BlockList()
  // IPv4 — private, loopback, link-local (incl. 169.254.169.254 metadata),
  // CGNAT, benchmark, documentation, multicast, reserved.
  b.addSubnet('0.0.0.0', 8, 'ipv4')
  b.addSubnet('10.0.0.0', 8, 'ipv4')
  b.addSubnet('100.64.0.0', 10, 'ipv4')
  b.addSubnet('127.0.0.0', 8, 'ipv4')
  b.addSubnet('169.254.0.0', 16, 'ipv4')
  b.addSubnet('172.16.0.0', 12, 'ipv4')
  b.addSubnet('192.0.0.0', 24, 'ipv4')
  b.addSubnet('192.0.2.0', 24, 'ipv4')
  b.addSubnet('192.168.0.0', 16, 'ipv4')
  b.addSubnet('198.18.0.0', 15, 'ipv4')
  b.addSubnet('198.51.100.0', 24, 'ipv4')
  b.addSubnet('203.0.113.0', 24, 'ipv4')
  b.addSubnet('224.0.0.0', 4, 'ipv4')
  b.addSubnet('240.0.0.0', 4, 'ipv4')
  b.addAddress('255.255.255.255', 'ipv4')
  // IPv6 — loopback, unspecified, unique-local (fc00::/7 incl. AWS metadata
  // fd00:ec2::254), link-local (fe80::/10), documentation.
  b.addAddress('::1', 'ipv6')
  b.addAddress('::', 'ipv6')
  b.addSubnet('fc00::', 7, 'ipv6')
  b.addSubnet('fe80::', 10, 'ipv6')
  b.addSubnet('2001:db8::', 32, 'ipv6')
  return b
}

const BLOCK_LIST = buildBlockList()

// Pull the embedded IPv4 out of an IPv4-mapped IPv6 address (both the dotted
// `::ffff:1.2.3.4` and hex `::ffff:0102:0304` forms), so a mapped loopback can't
// slip past the IPv4 rules.
const ipv4FromMapped = (ip: string): string | null => {
  const dotted = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i.exec(ip)
  if (dotted) return dotted[1]
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(ip)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`
  }
  return null
}

export const isBlockedIp = (ip: string): boolean => {
  const kind = isIP(ip)
  if (kind === 4) return BLOCK_LIST.check(ip, 'ipv4')
  if (kind === 6) {
    if (BLOCK_LIST.check(ip, 'ipv6')) return true
    const mapped = ipv4FromMapped(ip.toLowerCase())
    return mapped !== null && BLOCK_LIST.check(mapped, 'ipv4')
  }
  return false
}

// Resolve a hostname to every A/AAAA address. Uses resolve4/resolve6 rather than
// dns.lookup(): the Cloudflare Workers runtime implements these (backed by
// DNS-over-HTTPS to 1.1.1.1) but throws "Not implemented" for lookup(). Node
// resolves them the same way, so the guard behaves identically in dev and in
// production. Each family is queried independently and never rejects the whole
// call — a host with only A (or only AAAA) records is normal, so a per-family
// "no records" error is tolerated as long as the other family yields something.
const resolveHostIps = async (host: string): Promise<string[]> => {
  const settled = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)])
  return settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

// Hostnames that never point anywhere public.
const BLOCKED_HOST_NAMES: readonly string[] = ['localhost']
const BLOCKED_HOST_SUFFIXES: readonly string[] = ['.local', '.localhost', '.internal']

// Trim, add https:// when the scheme is missing, parse, and reject anything that
// isn't a syntactically valid http(s) URL. Throws ScanError with a safe message.
export const normalizeUrl = (input: string): URL => {
  const trimmed = input.trim()
  if (trimmed.length === 0) throw new ScanError('Enter a URL to scan.')
  if (trimmed.length > MAX_URL_LENGTH) throw new ScanError('That URL is too long.')

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
  const candidate = hasScheme ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new ScanError("That doesn't look like a valid URL.")
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScanError('Only http and https URLs can be scanned.')
  }
  if (url.hostname.length === 0) {
    throw new ScanError("That doesn't look like a valid URL.")
  }
  return url
}

// The full gate: scheme + host + resolved-IP check. Called before the initial
// fetch AND before following each redirect hop.
export const guardUrl = async (url: URL): Promise<void> => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ScanError('Only http and https URLs can be scanned.')
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host

  // Literal IP — check it directly, no DNS.
  if (isIP(bare) !== 0) {
    if (isBlockedIp(bare)) throw new ScanError(BLOCKED_MESSAGE)
    return
  }

  // Internal-looking hostnames.
  if (
    BLOCKED_HOST_NAMES.includes(host) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
  ) {
    throw new ScanError(BLOCKED_MESSAGE)
  }

  // Resolve and re-check every address the name maps to. Both families rejecting
  // (or returning nothing) means the name doesn't resolve — a user-fixable miss.
  const addresses = await resolveHostIps(host)
  if (addresses.length === 0) {
    throw new ScanError("Couldn't find that domain. Check the URL and try again.")
  }
  for (const address of addresses) {
    if (isBlockedIp(address)) throw new ScanError(BLOCKED_MESSAGE)
  }
}
