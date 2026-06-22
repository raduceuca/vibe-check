import type { Detector, VibeIssue, Severity } from '../types.js'
import { createIssue } from './createIssue.js'

// ── Discoverability / SEO audit ─────────────────────────────────────────────
// Implements the deterministic (DOM- and HTTP-detectable) checks from the
// discoverability pillar: the ones that don't need an LLM. Each failing check
// emits one issue tagged with the `seo` detector so the overlay can group them
// into a dedicated SEO tab.

const TITLE_MAX = 60
const DESC_MAX = 160

// Framework / placeholder titles a real page should never ship with.
const DEFAULT_TITLES: readonly string[] = [
  'untitled', 'document', 'my site', 'home', 'app', 'new project',
  'react app', 'create react app', 'vite app', 'vite + react', 'next app',
]

interface SeoFinding {
  readonly check: string
  readonly severity: Severity
  readonly title: string
  readonly description: string
  readonly detail?: string
}

const text = (el: Element | null): string => el?.getAttribute('content')?.trim() ?? ''

// Synchronous DOM checks. Each returns a finding when it FAILS, else null.
const domChecks: ReadonlyArray<() => SeoFinding | null> = [
  // ── Title ──────────────────────────────────────────────────────────────
  () => {
    const t = document.title.trim()
    if (t.length === 0) {
      return { check: 'title-missing', severity: 'warning', title: 'Missing page title', description: 'The page has no <title>. Search engines and browser tabs will show the URL or "Untitled".' }
    }
    return null
  },
  () => {
    const t = document.title.trim()
    if (t.length > TITLE_MAX) {
      return { check: 'title-too-long', severity: 'warning', title: 'Page title is too long', description: `The <title> is ${t.length} characters. Google truncates around ${TITLE_MAX}, so the end of your title is cut off in results.`, detail: `${t.length} chars` }
    }
    return null
  },
  () => {
    const t = document.title.trim().toLowerCase()
    if (t.length > 0 && DEFAULT_TITLES.includes(t)) {
      return { check: 'title-default', severity: 'error', title: 'Page title is a framework default', description: `The <title> is "${document.title.trim()}" — a placeholder. Every search result and browser tab shows it. Replace it with a real, descriptive title.`, detail: document.title.trim() }
    }
    return null
  },
  // ── Meta description ───────────────────────────────────────────────────
  () => {
    const desc = text(document.querySelector('meta[name="description"]'))
    if (desc.length === 0) {
      return { check: 'meta-description-missing', severity: 'warning', title: 'Missing meta description', description: 'No <meta name="description">. Google auto-generates a snippet from page text — usually a worse pitch than one you write.' }
    }
    return null
  },
  () => {
    const desc = text(document.querySelector('meta[name="description"]'))
    if (desc.length > DESC_MAX) {
      return { check: 'meta-description-too-long', severity: 'warning', title: 'Meta description is too long', description: `The meta description is ${desc.length} characters. Search engines truncate around ${DESC_MAX}.`, detail: `${desc.length} chars` }
    }
    return null
  },
  // ── Open Graph (social preview) ────────────────────────────────────────
  () => {
    if (text(document.querySelector('meta[property="og:image"]')).length === 0) {
      return { check: 'og-image-missing', severity: 'warning', title: 'Missing social preview image (og:image)', description: 'No <meta property="og:image">. When the page is shared on Slack, X, or iMessage the preview is a blank box.' }
    }
    return null
  },
  () => {
    if (text(document.querySelector('meta[property="og:title"]')).length === 0) {
      return { check: 'og-title-missing', severity: 'info', title: 'Missing og:title', description: 'No <meta property="og:title">. Social platforms fall back to the page <title>, which may not be share-optimized.' }
    }
    return null
  },
  () => {
    if (text(document.querySelector('meta[property="og:description"]')).length === 0) {
      return { check: 'og-description-missing', severity: 'info', title: 'Missing og:description', description: 'No <meta property="og:description">. Shared links show no descriptive text under the title.' }
    }
    return null
  },
  // ── Canonical ──────────────────────────────────────────────────────────
  () => {
    if (document.querySelector('link[rel="canonical"]') === null) {
      return { check: 'canonical-missing', severity: 'info', title: 'Missing canonical link', description: 'No <link rel="canonical">. Duplicate URLs (with/without trailing slash, query params) can fragment search ranking.' }
    }
    return null
  },
  // ── Headings ───────────────────────────────────────────────────────────
  () => {
    const h1s = document.querySelectorAll('h1')
    if (h1s.length === 0) {
      return { check: 'h1-missing', severity: 'warning', title: 'No <h1> heading', description: 'The page has no <h1>. The h1 is the strongest on-page topic signal for search engines.' }
    }
    if (h1s.length > 1) {
      return { check: 'h1-multiple', severity: 'info', title: 'Multiple <h1> headings', description: `The page has ${h1s.length} <h1> elements. Search engines read each as the page topic, scattering the signal. Use one h1 and demote the rest to h2.`, detail: `${h1s.length} found` }
    }
    return null
  },
  // ── Image alt text ─────────────────────────────────────────────────────
  () => {
    const missing = Array.from(document.images).filter((img) => !img.hasAttribute('alt')).length
    if (missing > 0) {
      return { check: 'image-alt-missing', severity: 'warning', title: 'Images missing alt text', description: `${missing} image${missing > 1 ? 's have' : ' has'} no alt attribute. Search engines and screen readers can't interpret them.`, detail: `${missing} image${missing > 1 ? 's' : ''}` }
    }
    return null
  },
  // ── URL slug ───────────────────────────────────────────────────────────
  () => {
    if (typeof location === 'undefined') return null
    const path = location.pathname
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    const unfriendly = uuid.test(path) || /[A-Z]/.test(path) || /_/.test(path)
    if (unfriendly && path !== '/') {
      return { check: 'slug-unfriendly', severity: 'info', title: 'Unfriendly URL slug', description: `The path "${path}" contains an ID, underscore, or capital letters. Clean, kebab-case slugs are easier to read and share.`, detail: path }
    }
    return null
  },
]

// HTTP checks for sitemap/robots — same-origin GET, treated as missing unless
// the response is OK and the content type looks right (a SPA dev server returns
// index.html for unknown paths, which we correctly read as "not a real sitemap").
const fetchResource = async (
  path: string,
  expectType: string,
): Promise<boolean> => {
  try {
    if (typeof fetch === 'undefined') return true // can't probe — assume ok
    const res = await fetch(path, { method: 'GET' })
    if (!res.ok) return false
    const ct = res.headers.get('content-type') ?? ''
    return ct.includes(expectType)
  } catch {
    return true // network error — don't false-flag
  }
}

export const createSeoDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let hasRun = false
  let cancelled = false
  let loadHandler: (() => void) | null = null
  let timerId: ReturnType<typeof setTimeout> | null = null

  const emit = (f: SeoFinding): void => {
    issues = [
      ...issues,
      createIssue('seo', f.severity, f.title, f.description, f.detail !== undefined ? { check: f.check, detail: f.detail } : { check: f.check }),
    ]
  }

  const runChecks = (): void => {
    if (typeof document === 'undefined') return
    if (hasRun) return
    hasRun = true

    for (const check of domChecks) {
      const finding = check()
      if (finding) emit(finding)
    }

    // Async resource probes — fire-and-forget, guarded against post-stop emits.
    void (async () => {
      const sitemapOk = await fetchResource('/sitemap.xml', 'xml')
      if (!cancelled && !sitemapOk) {
        emit({ check: 'sitemap-missing', severity: 'warning', title: 'Missing or invalid sitemap.xml', description: 'No valid /sitemap.xml. Search engines have to discover every page on their own, which slows full indexing.' })
      }
      const robotsOk = await fetchResource('/robots.txt', 'text/plain')
      if (!cancelled && !robotsOk) {
        emit({ check: 'robots-missing', severity: 'info', title: 'Missing robots.txt', description: 'No /robots.txt. It is optional but recommended — it tells crawlers what to index and where the sitemap is.' })
      }
    })()
  }

  return {
    name: 'seo',

    start(): void {
      if (typeof document === 'undefined') return
      cancelled = false
      // Run after a short delay to let the app render (SPA <head> is often set
      // by JS after first paint).
      if (document.readyState === 'complete') {
        timerId = setTimeout(runChecks, 500)
      } else {
        loadHandler = () => { timerId = setTimeout(runChecks, 500) }
        window.addEventListener('load', loadHandler, { once: true })
      }
    },

    stop(): void {
      cancelled = true
      if (timerId !== null) {
        clearTimeout(timerId)
        timerId = null
      }
      if (loadHandler !== null) {
        window.removeEventListener('load', loadHandler)
        loadHandler = null
      }
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      hasRun = false
    },
  }
}
