// Hub HTTP security contract (since 0.4). Pure helpers so the hub's request
// gate and the CLI's option parsing share one definition of "allowed".
//
// Policy (implemented by packages/mcp hubServer):
// - Host header: loopback names (127.0.0.0/8, localhost, *.localhost, [::1]) on
//   the hub's own port, plus explicitly allowed hosts. Anything else → 403
//   'host-not-allowed' (blocks DNS rebinding) on every route.
// - Origin (browser routes /api/*): absent → allowed (CLI / server clients);
//   loopback origins on any port → allowed; origins matching the configured
//   allowlist → allowed; 'null' or anything else → 403 'origin-not-allowed'.
// - CORS responses echo the request Origin when allowed (never '*') with
//   `Vary: Origin`; preflights answer Private Network Access
//   (`Access-Control-Allow-Private-Network: true`) for allowed origins only.
// - POST bodies must be `application/json` → else 415 'unsupported-media-type'.

export const HUB_ERROR_CODES = [
  'bad-request',
  'invalid-json',
  'payload-too-large',
  'unsupported-media-type',
  'origin-not-allowed',
  'host-not-allowed',
  'not-found',
  'method-not-allowed',
  'internal-error',
  'project-not-found',
  'issue-not-found',
  'hub-shutting-down',
] as const
export type HubErrorCode = (typeof HUB_ERROR_CODES)[number]

/** Body of every non-2xx hub response (codes specific to a route may add fields). */
export interface HubErrorBody {
  readonly error: string
  readonly code: HubErrorCode
  /** One plain-language next step, e.g. how to allow an origin. */
  readonly hint?: string
}

/** Comma- or space-separated extra browser origins the hub accepts. */
export const ALLOWED_ORIGINS_ENV = 'VIBE_CHECK_ALLOWED_ORIGINS'

const IPV4_LOOPBACK = /^127(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

/** localhost, *.localhost, 127.0.0.0/8 and ::1 (with or without brackets). */
export const isLoopbackHostname = (hostname: string): boolean => {
  const host = hostname.trim().toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
  return host === 'localhost'
    || host.endsWith('.localhost')
    || host === '::1'
    || IPV4_LOOPBACK.test(host)
}

interface ParsedOrigin {
  readonly scheme: 'http' | 'https'
  readonly hostname: string
  readonly port: number
}

const defaultPort = (scheme: 'http' | 'https'): number => scheme === 'https' ? 443 : 80

const parseOrigin = (origin: string): ParsedOrigin | null => {
  if (origin.trim().toLowerCase() === 'null') return null
  try {
    const url = new URL(origin.trim())
    const scheme = url.protocol === 'http:' ? 'http' : url.protocol === 'https:' ? 'https' : null
    if (scheme === null || url.username !== '' || url.password !== '') return null
    if (url.pathname !== '/' || url.search !== '' || url.hash !== '') return null
    return {
      scheme,
      hostname: url.hostname.toLowerCase(),
      port: url.port === '' ? defaultPort(scheme) : Number.parseInt(url.port, 10),
    }
  } catch {
    return null
  }
}

export const isLoopbackOrigin = (origin: string): boolean => {
  const parsed = parseOrigin(origin)
  return parsed !== null && isLoopbackHostname(parsed.hostname)
}

const ORIGIN_PATTERN = /^(https?):\/\/(\*\.)?((?:[a-z0-9-]+\.)*[a-z0-9-]+|\[[0-9a-f:.]+\])(?::(\d{1,5}|\*))?$/

/**
 * Normalizes an allowlist entry to `scheme://host[:port]`, `scheme://*.domain[:port]`
 * or `scheme://host:*` (any port). Default ports are dropped so exact entries
 * compare like a browser's Origin. Returns null for anything else (paths,
 * credentials, bare hosts, other schemes).
 */
export const normalizeOriginPattern = (value: string): string | null => {
  const candidate = value.trim().toLowerCase().replace(/\/+$/, '')
  const match = ORIGIN_PATTERN.exec(candidate)
  if (!match) return null
  const scheme = match[1] as 'http' | 'https'
  const wildcard = match[2] ?? ''
  const host = match[3] ?? ''
  const port = match[4]
  if (port !== undefined && port !== '*') {
    const numeric = Number.parseInt(port, 10)
    if (numeric < 1 || numeric > 65_535) return null
    if (numeric === defaultPort(scheme)) return `${scheme}://${wildcard}${host}`
  }
  return `${scheme}://${wildcard}${host}${port === undefined ? '' : `:${port}`}`
}

/** Parses VIBE_CHECK_ALLOWED_ORIGINS / repeated --allow-origin values; invalid entries are dropped. */
export const parseAllowedOrigins = (value: string | readonly string[] | undefined): readonly string[] => {
  const raw = value === undefined ? [] : typeof value === 'string' ? [value] : value
  const patterns = raw
    .flatMap((item) => item.split(/[\s,]+/))
    .filter((item) => item.length > 0)
    .map(normalizeOriginPattern)
    .filter((item): item is string => item !== null)
  return [...new Set(patterns)]
}

const matchesPattern = (origin: ParsedOrigin, pattern: string): boolean => {
  const match = ORIGIN_PATTERN.exec(pattern)
  if (!match) return false
  const scheme = match[1] as 'http' | 'https'
  if (scheme !== origin.scheme) return false
  const host = match[3] ?? ''
  const hostOk = match[2] !== undefined
    ? origin.hostname.endsWith(`.${host}`)
    : origin.hostname === host
  if (!hostOk) return false
  const port = match[4]
  if (port === '*') return true
  return origin.port === (port === undefined ? defaultPort(scheme) : Number.parseInt(port, 10))
}

/**
 * True when a browser request's Origin may use the hub: any loopback origin,
 * or one matching an allowlist pattern (see normalizeOriginPattern). A missing
 * Origin is the caller's decision (non-browser clients send none); this
 * function answers false for it, and for the literal 'null' origin.
 */
export const isOriginAllowed = (
  origin: string | null | undefined,
  allowlist: readonly string[] = [],
): boolean => {
  if (origin === null || origin === undefined || origin.length === 0) return false
  const parsed = parseOrigin(origin)
  if (parsed === null) return false
  if (isLoopbackHostname(parsed.hostname)) return true
  return allowlist.some((pattern) => {
    const normalized = normalizeOriginPattern(pattern)
    return normalized !== null && matchesPattern(parsed, normalized)
  })
}

const HOST_HEADER = /^(\[[0-9a-f:.]+\]|[^:[\]]+)(?::(\d{1,5}))?$/

/**
 * True when the Host header names this hub: a loopback name on `port`, or an
 * entry of `extraHosts` (`host` means that host on `port`; `host:port` is
 * exact). A missing Host header is rejected.
 */
export const isHostHeaderAllowed = (
  host: string | null | undefined,
  port: number,
  extraHosts: readonly string[] = [],
): boolean => {
  if (host === null || host === undefined) return false
  const value = host.trim().toLowerCase()
  const match = HOST_HEADER.exec(value)
  if (!match) return false
  const hostname = match[1] ?? ''
  const headerPort = match[2] === undefined ? 80 : Number.parseInt(match[2], 10)
  const extraAllowed = extraHosts.some((entry) => {
    const allowed = HOST_HEADER.exec(entry.trim().toLowerCase())
    if (!allowed) return false
    if (allowed[1] !== hostname) return false
    return allowed[2] === undefined ? headerPort === port : Number.parseInt(allowed[2], 10) === headerPort
  })
  if (extraAllowed) return true
  return isLoopbackHostname(hostname) && headerPort === port
}

/** Decodes each path segment; null when any segment has a malformed percent-escape. */
export const safeDecodePathSegments = (pathname: string): readonly string[] | null => {
  try {
    return pathname.split('/').filter((part) => part.length > 0).map((part) => decodeURIComponent(part))
  } catch {
    return null
  }
}

/** `application/json`, with or without parameters such as charset. */
export const isJsonContentType = (value: string | null | undefined): boolean =>
  (value ?? '').split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
