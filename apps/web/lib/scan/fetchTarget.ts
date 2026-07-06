import { guardUrl, normalizeUrl, ScanError } from './ssrf'

// ── The fetch boundary ───────────────────────────────────────────────────────
// The ONE place the target site is touched. Everything downstream (the checks,
// the API route, the page) depends only on the returned TargetFetch shape — so a
// future Cloudflare Browser-Rendering backend can replace fetchTarget() without
// changing a single check or a line of UI. Redirects are followed manually and
// re-guarded on every hop to keep the SSRF guard airtight.

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 VibeCheckScanner/1.0'

const HTML_ACCEPT = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'

const MAIN_TIMEOUT_MS = 8000
const SUB_TIMEOUT_MS = 4000
const MAX_HTML_BYTES = 3 * 1024 * 1024 // 3 MB
const MAX_SUB_BYTES = 512 * 1024 // 512 KB
const MAX_REDIRECTS = 4

// One fetched sub-resource of the target origin (llms.txt, robots.txt, …).
export interface SubResource {
  readonly ok: boolean
  readonly status: number
  readonly contentType: string
  readonly body: string
}

export interface TargetResources {
  readonly sitemap: SubResource
  readonly robots: SubResource
  readonly llms: SubResource
  readonly mcp: SubResource
  readonly markdown: SubResource
}

export interface TargetFetch {
  readonly finalUrl: string
  readonly html: string
  readonly resources: TargetResources
}

const fetchWithTimeout = async (
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const cancelBody = async (res: Response): Promise<void> => {
  try {
    await res.body?.cancel()
  } catch {
    // ignore — best-effort cleanup
  }
}

// Follow redirects by hand, re-running the SSRF guard on each hop so a public
// URL can't 30x us into an internal address. Network failures surface as a
// user-safe ScanError; guard rejections propagate unchanged.
const safeFetch = async (
  start: URL,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ url: URL; res: Response }> => {
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await guardUrl(url)

    let res: Response
    try {
      res = await fetchWithTimeout(
        url.toString(),
        { redirect: 'manual', headers: { 'user-agent': USER_AGENT, ...headers } },
        timeoutMs,
      )
    } catch {
      throw new ScanError(
        "Couldn't reach that URL — it may be down, too slow, or blocking scanners.",
      )
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (location === null) return { url, res }
      await cancelBody(res)
      try {
        url = new URL(location, url)
      } catch {
        throw new ScanError('That URL redirects somewhere invalid.')
      }
      continue
    }
    return { url, res }
  }
  throw new ScanError('That URL redirects too many times.')
}

// Read a response body up to `cap` bytes, THROWING if the stream exceeds it.
// Used for the main document so an oversized page is rejected, not truncated.
const readStrict = async (res: Response, cap: number): Promise<string> => {
  const stream = res.body
  if (stream === null) return ''
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > cap) {
        await reader.cancel()
        throw new ScanError('That page is too large to scan (over 3 MB).')
      }
      chunks.push(Buffer.from(value))
    }
  }
  return Buffer.concat(chunks).toString('utf8')
}

// Read up to `cap` bytes, TRUNCATING silently past it. Used for sub-resources
// where we only need the head of the file (content-type + a few rules).
const readSoft = async (res: Response, cap: number): Promise<string> => {
  const stream = res.body
  if (stream === null) return ''
  const reader = stream.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(Buffer.from(value))
      total += value.byteLength
      if (total >= cap) {
        await reader.cancel()
        break
      }
    }
  }
  return Buffer.concat(chunks).toString('utf8')
}

// Best-effort GET of a target sub-resource. Never throws — a failure just means
// "not served", which is exactly what the AEO/SEO checks want to know.
const fetchSub = async (
  target: URL,
  headers: Record<string, string> = {},
): Promise<SubResource> => {
  try {
    const { res } = await safeFetch(target, headers, SUB_TIMEOUT_MS)
    const contentType = res.headers.get('content-type') ?? ''
    if (res.status < 200 || res.status >= 300) {
      await cancelBody(res)
      return { ok: false, status: res.status, contentType, body: '' }
    }
    const body = await readSoft(res, MAX_SUB_BYTES)
    return { ok: true, status: res.status, contentType, body }
  } catch {
    return { ok: false, status: 0, contentType: '', body: '' }
  }
}

const fetchResources = async (origin: URL): Promise<TargetResources> => {
  const at = (path: string): URL => new URL(path, origin)
  const pageMarkdown = new URL(`${origin.pathname}${origin.search}`, origin)

  const [sitemap, robots, llms, mcp, markdown] = await Promise.all([
    fetchSub(at('/sitemap.xml')),
    fetchSub(at('/robots.txt')),
    fetchSub(at('/llms.txt')),
    fetchSub(at('/.well-known/mcp.json')),
    fetchSub(pageMarkdown, { accept: 'text/markdown' }),
  ])

  return { sitemap, robots, llms, mcp, markdown }
}

// Fetch the target document + the sub-resources the checks need. The single
// swappable seam for a future headless-render backend.
export const fetchTarget = async (input: string): Promise<TargetFetch> => {
  const start = normalizeUrl(input)
  const { url: finalUrl, res } = await safeFetch(start, { accept: HTML_ACCEPT }, MAIN_TIMEOUT_MS)

  if (res.status < 200 || res.status >= 300) {
    await cancelBody(res)
    throw new ScanError(
      `That URL returned HTTP ${res.status}. Make sure it's a public, working page.`,
    )
  }

  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
  if (!contentType.includes('text/html')) {
    await cancelBody(res)
    const served = contentType.split(';')[0] || 'an unknown type'
    throw new ScanError(
      `That URL isn't an HTML page (it served ${served}). Point the scanner at a web page.`,
    )
  }

  const html = await readStrict(res, MAX_HTML_BYTES)
  const resources = await fetchResources(finalUrl)

  return { finalUrl: finalUrl.toString(), html, resources }
}
