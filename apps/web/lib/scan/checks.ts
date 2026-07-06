import { parseHTML } from 'linkedom'
import type { Severity } from '@wcgw/vibe-check-core'
import type { ScanCheck } from './types'
import type { TargetFetch } from './fetchTarget'

// ── Server port of the SEO + AEO detectors ───────────────────────────────────
// A faithful re-implementation of packages/core/src/detectors/seo.ts and
// aeo.ts, run against a linkedom document + the fetched sub-resources instead of
// a live browser DOM. Same check ids, same severities, and the same labels the
// on-site AuditThisPage catalog uses — so a /scan result reconciles exactly with
// VibeCheck's own audit semantics. Where a check genuinely needs a rendered DOM
// (content-renders-without-JS), it runs against the raw served HTML and reports
// honestly: an SPA correctly trips "content only renders with JavaScript".

const TITLE_MAX = 60
const DESC_MAX = 160

// Framework / placeholder titles a real page should never ship with.
const DEFAULT_TITLES: readonly string[] = [
  'untitled', 'document', 'my site', 'home', 'app', 'new project',
  'react app', 'create react app', 'vite app', 'vite + react', 'next app',
]

// Known AI / answer-engine crawler user-agents (mirrors aeo.ts).
const AI_BOTS: readonly string[] = [
  'gptbot', 'oai-searchbot', 'chatgpt-user', 'claudebot', 'claude-web',
  'anthropic-ai', 'perplexitybot', 'google-extended', 'ccbot', 'bytespider',
  'cohere-ai', 'meta-externalagent', 'applebot-extended',
]

// Ported verbatim from aeo.ts — the AI bots a robots.txt disallows from root.
const blockedAiBots = (robots: string): string[] => {
  const lines = robots.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  const blocked = new Set<string>()
  let agents: string[] = []
  let collectingAgents = false

  for (const line of lines) {
    const [rawKey, ...rest] = line.split(':')
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()

    if (key === 'user-agent') {
      if (!collectingAgents) agents = []
      agents.push(value.toLowerCase())
      collectingAgents = true
    } else if (key === 'disallow') {
      collectingAgents = false
      if (value === '/') {
        for (const a of agents) {
          if (a === '*' || AI_BOTS.includes(a)) blocked.add(a === '*' ? 'all crawlers (*)' : a)
        }
      }
    } else {
      collectingAgents = false
    }
  }
  return [...blocked]
}

type Doc = ReturnType<typeof parseHTML>['document']

const metaContent = (doc: Doc, selector: string): string =>
  doc.querySelector(selector)?.getAttribute('content')?.trim() ?? ''

// A check row: detail is attached only on a miss (mirrors the detector, which
// emits its evidence string only when the finding fires).
const row = (
  id: string,
  severity: Severity,
  label: string,
  pass: boolean,
  detail?: string,
): ScanCheck =>
  !pass && detail !== undefined
    ? { id, label, pass, severity, detail }
    : { id, label, pass, severity }

const includesType = (contentType: string, needle: string): boolean =>
  contentType.toLowerCase().includes(needle)

// ── SEO — 19 checks (17 DOM + sitemap + robots), matching SEO_CRITERIA_COUNT ──
export const runSeoChecks = (doc: Doc, finalUrl: URL, target: TargetFetch): ScanCheck[] => {
  const title = (doc.title ?? '').trim()
  const titleLower = title.toLowerCase()
  const desc = metaContent(doc, 'meta[name="description"]')
  const h1Count = doc.querySelectorAll('h1').length
  const imgsMissingAlt = [...doc.querySelectorAll('img')].filter((img) => !img.hasAttribute('alt')).length
  const generic = /^(click here|here|read more|learn more|more|link|this|click)$/i
  const vagueLinks = [...doc.querySelectorAll('a')].filter((a) => generic.test((a.textContent ?? '').trim())).length
  const robotsMeta = (doc.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '').toLowerCase()

  const path = finalUrl.pathname
  const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  const slugUnfriendly = (uuid.test(path) || /[A-Z]/.test(path) || /_/.test(path)) && path !== '/'

  const { sitemap, robots } = target.resources
  const sitemapValid = sitemap.ok && includesType(sitemap.contentType, 'xml')
  const robotsServed = robots.ok && includesType(robots.contentType, 'text/plain')

  // The h1 criterion merges two detector findings: h1-missing (0) and
  // h1-multiple (>1). Pick the id/severity/detail that matches the actual miss.
  const h1Id = h1Count > 1 ? 'h1-multiple' : 'h1-missing'
  const h1Severity: Severity = h1Count > 1 ? 'info' : 'warning'
  const h1Detail = h1Count > 1 ? `${h1Count} found` : undefined

  return [
    row('title-missing', 'warning', 'Page has a <title>', title.length > 0),
    row('title-too-long', 'warning', 'Title fits in ~60 characters', title.length <= TITLE_MAX, `${title.length} chars`),
    row('title-default', 'error', 'Title is not a framework placeholder', !(title.length > 0 && DEFAULT_TITLES.includes(titleLower)), title),
    row('title-too-short', 'warning', 'Title is descriptive (10+ chars)', !(title.length > 0 && title.length < 10 && !DEFAULT_TITLES.includes(titleLower)), `${title.length} chars`),
    row('meta-description-missing', 'warning', 'Has a meta description', desc.length > 0),
    row('meta-description-too-long', 'warning', 'Meta description within ~160 chars', desc.length <= DESC_MAX, `${desc.length} chars`),
    row('og-image-missing', 'warning', 'Has an og:image social preview', metaContent(doc, 'meta[property="og:image"]').length > 0),
    row('og-title-missing', 'info', 'Has an og:title', metaContent(doc, 'meta[property="og:title"]').length > 0),
    row('og-description-missing', 'info', 'Has an og:description', metaContent(doc, 'meta[property="og:description"]').length > 0),
    row('og-url-missing', 'info', 'Has an og:url', metaContent(doc, 'meta[property="og:url"]').length > 0),
    row('twitter-card-missing', 'info', 'Has a Twitter / X card', metaContent(doc, 'meta[name="twitter:card"]').length > 0),
    row('canonical-missing', 'info', 'Declares a canonical URL', doc.querySelector('link[rel="canonical"]') !== null),
    row(h1Id, h1Severity, 'Has exactly one <h1>', h1Count === 1, h1Detail),
    row('image-alt-missing', 'warning', 'All images have alt text', imgsMissingAlt === 0, `${imgsMissingAlt} image${imgsMissingAlt === 1 ? '' : 's'}`),
    row('generic-link-text', 'info', 'Link text is descriptive', vagueLinks === 0, `${vagueLinks} link${vagueLinks === 1 ? '' : 's'}`),
    row('slug-unfriendly', 'info', 'URL slug is clean', !slugUnfriendly, path),
    row('noindex', 'error', 'Page is indexable (no noindex)', !robotsMeta.includes('noindex'), 'noindex'),
    row('sitemap-missing', 'warning', 'Serves a valid sitemap.xml', sitemapValid),
    row('robots-missing', 'info', 'Serves a robots.txt', robotsServed),
  ]
}

// ── AEO — 9 checks, matching AEO_CRITERIA_COUNT ──────────────────────────────
export const runAeoChecks = (doc: Doc, target: TargetFetch): ScanCheck[] => {
  const ld = doc.querySelector('script[type="application/ld+json"]')
  const ldPresent = ld !== null
  // When JSON-LD is absent the "valid" criterion passes (only the "present"
  // criterion fails) — this mirrors the detector's own scoring exactly.
  let ldValid = true
  if (ldPresent) {
    try {
      const parsed: unknown = JSON.parse(ld?.textContent ?? '')
      ldValid = parsed !== null && typeof parsed === 'object' && JSON.stringify(parsed).includes('schema.org')
    } catch {
      ldValid = false
    }
  }

  const hasMain = doc.querySelector('main') !== null
  const hasAuthor =
    doc.querySelector('meta[name="author"], meta[property="article:author"], [itemprop="author"]') !== null

  // Content-without-JS: the raw served HTML's visible text length. An SPA that
  // renders client-side correctly trips this.
  const rawLen = (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim().length

  const { llms, markdown, robots, mcp } = target.resources
  const llmsServed = llms.ok && (includesType(llms.contentType, 'text/plain') || includesType(llms.contentType, 'markdown'))
  // Fails only when the markdown request succeeded but returned non-markdown
  // (server ignored the Accept header) — faithful to aeo.ts.
  const markdownOffered = !(markdown.ok && !includesType(markdown.contentType, 'markdown'))
  const blocked = robots.ok ? blockedAiBots(robots.body) : []
  const aiAllowed = !(robots.ok && blocked.length > 0)
  const mcpServed = mcp.ok && includesType(mcp.contentType, 'json')

  return [
    row('structured-data-missing', 'warning', 'Ships structured data (JSON-LD)', ldPresent),
    row('structured-data-invalid', 'warning', 'Structured data is valid schema.org', ldValid),
    row('no-main-landmark', 'info', 'Has a <main> landmark', hasMain),
    row('no-author-metadata', 'info', 'Exposes author / date signals', hasAuthor),
    row('llms-txt-missing', 'info', 'Serves an llms.txt', llmsServed),
    row('content-requires-js', 'warning', 'Content renders without JavaScript', rawLen >= 200, `${rawLen} chars in raw HTML`),
    row('markdown-negotiation-missing', 'info', 'Offers markdown content negotiation', markdownOffered),
    row('ai-crawlers-blocked', 'warning', 'Allows AI crawlers in robots.txt', aiAllowed, blocked.join(', ') || undefined),
    row('mcp-discovery-missing', 'info', 'Advertises an MCP interface', mcpServed),
  ]
}
