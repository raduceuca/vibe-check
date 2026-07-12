// Privacy-preserving host handling. We only ever store and serve a hostname —
// path, query string and credentials are dropped before anything is persisted.

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

// Reduce any user-supplied url/host string to a bare hostname:
//   - lowercased
//   - `www.` stripped (so www.foo.com and foo.com don't duplicate)
//   - no scheme, path, query, port, or user:pass credentials
// Returns null for anything that isn't a resolvable public-looking hostname.
export const toHost = (input: string): string | null => {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > 2048) return null

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

    // URL.hostname already excludes credentials, port, path and query.
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '')

    // Must look like a real domain (has a dot, no whitespace).
    if (!host.includes('.') || /\s/.test(host)) return null
    if (host.length > 253) return null
    return host
  } catch {
    return null
  }
}

// The only thing we store in the `url` column: the bare origin, so even that
// field can never leak a path or query.
export const toOrigin = (host: string): string => `https://${host}`

// Short, opaque, url-safe shareable id. Not derived from the host, so the slug
// leaks nothing. Collisions across hosts are astronomically unlikely at 8 chars.
export const generateSlug = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let out = ''
  for (const byte of bytes) out += SLUG_ALPHABET[byte % SLUG_ALPHABET.length]
  return out
}

// Combined pass rate across both audits, clamped to 0..1. Guards divide-by-zero.
export const computeScore = (
  seoPassed: number,
  seoTotal: number,
  aeoPassed: number,
  aeoTotal: number,
): number => {
  const passed = seoPassed + aeoPassed
  const total = seoTotal + aeoTotal
  if (total <= 0) return 0
  const raw = passed / total
  return Math.min(1, Math.max(0, raw))
}
