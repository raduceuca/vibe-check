// ── Site-wide constants ──────────────────────────────────────────────────────
// Single source for the absolute origin (used by canonicals, OpenGraph, JSON-LD,
// sitemap, robots, llms.txt) and the shared top-nav links.

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vibecheck.dev'
).replace(/\/$/, '')

export const SITE_NAME = 'VibeCheck'

export const GITHUB_URL = 'https://github.com/raduceuca/vibe-check'

// Absolute URL for a site-relative path.
export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

export interface NavLink {
  readonly label: string
  readonly href: string
  readonly external?: boolean
}

// The quiet top nav shared across landing, /fix, and docs.
export const NAV_LINKS: readonly NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Fix guides', href: '/fix' },
  { label: 'Docs', href: '/docs' },
  { label: 'GitHub', href: GITHUB_URL, external: true },
]
