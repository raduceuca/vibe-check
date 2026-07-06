import type { DetectorName, Severity } from '@wcgw/vibe-check-core'

// ── The problem data model ───────────────────────────────────────────────────
// One entry per canonical problem VibeCheck catches. Every /fix/* landing page
// is generated from this shape. Content is derived from the real detector code
// (packages/core/src/detectors/*) and the fix templates in
// packages/core/src/suggestions/index.ts, then enriched with framework-accurate
// guidance — no filler.

export type { DetectorName, Severity }

// The four content pillars. `essentials` is the web-essentials detector; the
// others map to detector groups.
export type Category = 'performance' | 'seo' | 'aeo' | 'essentials'

// The frameworks a problem's fix can be specialised for. A framework variant
// page (/fix/<slug>/<framework>) is generated only for problems that carry a
// `frameworkFixes` entry for that framework.
export type Framework = 'react' | 'nextjs' | 'vue' | 'svelte' | 'vanilla'

export const FRAMEWORKS: readonly Framework[] = ['react', 'nextjs', 'vue', 'svelte', 'vanilla']

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  react: 'React',
  nextjs: 'Next.js',
  vue: 'Vue',
  svelte: 'Svelte',
  vanilla: 'Vanilla JS',
}

export const CATEGORY_LABELS: Record<Category, string> = {
  performance: 'Performance',
  seo: 'Search visibility',
  aeo: 'AI readiness',
  essentials: 'Web essentials',
}

// A syntax-highlightable code sample. `lang` maps to a highlight.js / Shiki
// grammar id; `caption` is an optional one-line label rendered above the block.
export interface CodeBlock {
  readonly lang: 'tsx' | 'ts' | 'jsx' | 'js' | 'html' | 'vue' | 'svelte' | 'bash' | 'json' | 'css' | 'xml'
  readonly code: string
  readonly caption?: string
}

// How the fix differs for one framework. `note` explains the framework-specific
// angle; `code` is the concrete implementation; `docsUrl` links upstream docs.
export interface FrameworkFix {
  readonly note: string
  readonly code: readonly CodeBlock[]
  readonly docsUrl?: string
}

// A single FAQ pair. Feeds the on-page FAQ section AND the FAQPage JSON-LD that
// answer engines read.
export interface FaqItem {
  readonly q: string
  readonly a: string
}

// How VibeCheck's own detector catches this problem: the real detector name, the
// literal issue string it emits into the Problems list, and the threshold that
// trips it. This is the dogfooding hook — the same string appears in the widget.
export interface Detection {
  readonly detector: DetectorName
  readonly issueString: string
  readonly threshold: string
}

export interface Problem {
  // ── Identity ──────────────────────────────────────────────────────────────
  readonly slug: string
  readonly category: Category
  readonly detector: DetectorName
  // The audit check id for seo/aeo/web-essentials detectors (e.g.
  // 'meta-description-missing'). Undefined for single-issue performance detectors.
  readonly checkId?: string
  readonly severity: Severity

  // ── Metadata (dogfoods VibeCheck's own SEO audit) ──────────────────────────
  readonly title: string // ≤ 60 chars — used verbatim for <title>
  readonly metaDescription: string // ≤ 160 chars
  readonly h1: string

  // ── Content ────────────────────────────────────────────────────────────────
  readonly pain: string // 2–3 sentences: why it hurts, especially in AI-built frontends
  readonly symptoms: readonly string[]
  readonly detection: Detection
  readonly rootCauses: readonly string[]
  readonly fix: {
    readonly summary: string // framework-agnostic explanation
    readonly code: readonly CodeBlock[]
    // Ordered, imperative steps — when present the page emits HowTo JSON-LD.
    readonly steps?: readonly string[]
  }
  readonly frameworkFixes?: Partial<Record<Framework, FrameworkFix>>
  readonly faq: readonly FaqItem[]
  readonly related: readonly string[] // slugs of related problems
}
