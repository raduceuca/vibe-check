// ── Audit probes ─────────────────────────────────────────────────────────────
// The seo / aeo audits fetch a few same-origin URLs (robots.txt, sitemap.xml,
// llms.txt, the page itself). Those are VibeCheck's own requests, so they must
// never count as the page's duplicate fetches. probeFetch() tags every request
// with VC_PROBE in its init; the duplicate-requests detector ignores tagged
// calls. A shared ProbeCache lets several audits in one run batch fetch each URL
// once (robots.txt is read by both seo and aeo).

/** Marker in a fetch init: this request is a VibeCheck audit probe, not app traffic. */
export const VC_PROBE: unique symbol = Symbol.for('vibecheck.probe')

export type ProbeRequestInit = RequestInit & { readonly [VC_PROBE]?: true }

export interface ProbeResult {
  /** HTTP 2xx. */
  readonly ok: boolean
  /** HTTP status, or null when no response arrived. */
  readonly status: number | null
  /** Response content-type, lowercased ('' when absent). */
  readonly contentType: string
  /** Response text for 2xx responses (capped), else ''. */
  readonly body: string
  /**
   * The request never got a response (offline, DNS, CORS, timeout, no fetch).
   * Such a check could not be evaluated; it is neither a pass nor a fail.
   */
  readonly networkError: boolean
}

/** One cache per audit run batch. Key: method + url + accept header. */
export type ProbeCache = Map<string, Promise<ProbeResult>>

export interface AuditDetectorOptions {
  /**
   * Share probe results between audits started together (seo + aeo). The owner
   * of the cache decides its lifetime: clear it before each new batch so a
   * re-check fetches fresh results. Without it, each run uses a private cache.
   */
  readonly probeCache?: ProbeCache
}

export const PROBE_TIMEOUT_MS = 10_000
const MAX_PROBE_BODY_CHARS = 1_000_000

const NETWORK_ERROR: ProbeResult = {
  ok: false,
  status: null,
  contentType: '',
  body: '',
  networkError: true,
}

export const createProbeCache = (): ProbeCache => new Map()

const headerValue = (headers: HeadersInit | undefined, name: string): string => {
  if (headers === undefined) return ''
  try {
    return new Headers(headers).get(name) ?? ''
  } catch {
    return ''
  }
}

const cacheKey = (url: string, init: RequestInit | undefined): string =>
  `${(init?.method ?? 'GET').toUpperCase()} ${url} ${headerValue(init?.headers, 'accept')}`

const runProbe = async (url: string, init: RequestInit | undefined): Promise<ProbeResult> => {
  if (typeof fetch === 'undefined') return NETWORK_ERROR
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller !== null ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null
  try {
    const probeInit: ProbeRequestInit = {
      ...init,
      ...(controller !== null && init?.signal == null ? { signal: controller.signal } : {}),
      [VC_PROBE]: true,
    }
    const res = await fetch(url, probeInit)
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    const body = res.ok ? (await res.text()).slice(0, MAX_PROBE_BODY_CHARS) : ''
    return { ok: res.ok, status: res.status, contentType, body, networkError: false }
  } catch {
    return NETWORK_ERROR
  } finally {
    if (timer !== null) clearTimeout(timer)
  }
}

/**
 * fetch() for VibeCheck's own audit probes: tagged with VC_PROBE, never throws,
 * resolves to a ProbeResult. With a cache, one request per method + url +
 * accept header is made; later callers share the same promise.
 */
export const probeFetch = (
  url: string,
  init?: RequestInit,
  cache?: ProbeCache,
): Promise<ProbeResult> => {
  if (cache === undefined) return runProbe(url, init)
  const key = cacheKey(url, init)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const pending = runProbe(url, init)
  cache.set(key, pending)
  return pending
}

/** True when this fetch init carries the VibeCheck probe marker. */
export const isProbeInit = (init: unknown): boolean => {
  if (init === null || typeof init !== 'object') return false
  try {
    return (init as { readonly [VC_PROBE]?: unknown })[VC_PROBE] === true
  } catch {
    return false
  }
}
