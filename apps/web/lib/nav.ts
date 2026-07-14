import { CATEGORY_META, problemsInCategory } from './problems'
import { GITHUB_URL } from './site'

// ── Site-wide nav model ──────────────────────────────────────────────────────
// The single source of truth for the persistent left SiteSidebar (landing / scan
// / fix) and for keeping the docs (Fumadocs) sidebar in structural sync. The fix
// tree is built on the SERVER from the heavy problem data and passed to the
// client SiteSidebar as lightweight {slug,label,href} — no problem content is
// bundled into client JS (SiteSidebar imports only the *types* from here).

export const SITE_VERSION = '0.3.0'

export interface NavItem {
  readonly label: string
  readonly href: string
  readonly external?: boolean
}

export interface FixCategoryNode {
  readonly key: string
  readonly label: string
  readonly href: string
  readonly problems: readonly NavItem[]
}

export interface SidebarData {
  readonly version: string
  readonly primary: readonly NavItem[]
  readonly fix: readonly FixCategoryNode[]
  readonly docs: readonly NavItem[]
  readonly resources: readonly NavItem[]
  readonly github: string
}

// Flat primary destinations above the two expandable sections.
const PRIMARY: readonly NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Scan', href: '/scan' },
]

// The six doc groups, each pointing at the first page of the group. Kept in sync
// with content/docs/meta.json + the per-folder meta.json titles so the landing /
// fix sidebar's "Docs" section mirrors the docs sidebar's own tree.
const DOCS_GROUPS: readonly NavItem[] = [
  { label: 'Getting Started', href: '/docs' },
  { label: 'Concepts', href: '/docs/concepts/architecture' },
  { label: 'Integration Guides', href: '/docs/integration' },
  { label: 'AI Agent Setup', href: '/docs/ai-agents/overview' },
  { label: 'Reference', href: '/docs/reference/detectors' },
  { label: 'Troubleshooting', href: '/docs/troubleshooting' },
]

const RESOURCES: readonly NavItem[] = [
  { label: 'Changelog', href: `${GITHUB_URL}/releases`, external: true },
  { label: 'GitHub', href: GITHUB_URL, external: true },
]

// Server-only: assembles the full sidebar tree, resolving the fix categories to
// their problems. Call from a Server Component and pass the result to SiteSidebar.
export const buildSidebarData = (): SidebarData => ({
  version: SITE_VERSION,
  primary: PRIMARY,
  fix: CATEGORY_META.map((c) => ({
    key: c.key,
    label: c.label,
    href: `/fix/${c.key}`,
    problems: problemsInCategory(c.key).map((p) => ({
      label: p.h1,
      href: `/fix/${p.slug}`,
    })),
  })),
  docs: DOCS_GROUPS,
  resources: RESOURCES,
  github: GITHUB_URL,
})
