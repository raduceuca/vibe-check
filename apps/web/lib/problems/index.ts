import type { Category, Framework, Problem } from './types'
import { FRAMEWORKS } from './types'
import { performanceRuntimeProblems } from './performance-runtime'
import { performanceAssetProblems } from './performance-assets'
import { seoTitleProblems } from './seo-titles'
import { seoSocialProblems } from './seo-social'
import { seoContentProblems } from './seo-content'
import { seoCrawlProblems } from './seo-crawl'
import { aeoContentProblems } from './aeo-content'
import { aeoAgentProblems } from './aeo-agents'
import { essentialsProblems } from './essentials'

export * from './types'

// ── The full canonical problem set ───────────────────────────────────────────
// 43 problems = 10 performance detectors + 20 SEO checks + 9 AEO checks + 4
// web-essentials checks. Assembled from the per-category files (each kept small).

export const ALL_PROBLEMS: readonly Problem[] = [
  ...performanceRuntimeProblems,
  ...performanceAssetProblems,
  ...seoTitleProblems,
  ...seoSocialProblems,
  ...seoContentProblems,
  ...seoCrawlProblems,
  ...aeoContentProblems,
  ...aeoAgentProblems,
  ...essentialsProblems,
]

const BY_SLUG: ReadonlyMap<string, Problem> = new Map(
  ALL_PROBLEMS.map((p) => [p.slug, p]),
)

export const getProblem = (slug: string): Problem | undefined => BY_SLUG.get(slug)

export const getAllSlugs = (): readonly string[] => ALL_PROBLEMS.map((p) => p.slug)

// ── Categories ───────────────────────────────────────────────────────────────
// The four content pillars, ordered for the hub + sidebar. Each carries the copy
// its category landing page needs.

export interface CategoryMeta {
  readonly key: Category
  readonly label: string
  readonly tagline: string
  readonly intro: string
  readonly detectorNote: string
}

export const CATEGORY_META: readonly CategoryMeta[] = [
  {
    key: 'performance',
    label: 'Performance',
    tagline: 'Runtime, memory & payload',
    intro:
      'Runtime problems that make an AI-built page slow, janky, or heavy — DOM bloat, memory leaks, layout shift, long tasks, oversized images and bundles. Each one is caught live by a VibeCheck detector as it happens in the browser.',
    detectorNote: 'Caught by the dom-bloat, memory-leak, layout-thrashing, long-task, image, resource and heavy-library detectors.',
  },
  {
    key: 'seo',
    label: 'Search visibility',
    tagline: 'Be found by search engines',
    intro:
      'Discoverability problems that keep search engines from ranking — or even reading — your pages: missing titles and descriptions, absent Open Graph and canonical tags, heading and alt-text gaps, and missing sitemap/robots files.',
    detectorNote: 'Caught by the seo audit — 20 deterministic, DOM- and HTTP-detectable checks.',
  },
  {
    key: 'aeo',
    label: 'AI readiness',
    tagline: 'Be read by answer engines',
    intro:
      'Answer-engine problems that stop AI assistants (ChatGPT, Perplexity, Claude, Google AI Overviews) from reading, trusting, and citing your content — missing structured data, client-only rendering, blocked AI crawlers, and absent agent-discovery signals.',
    detectorNote: 'Caught by the aeo audit — 9 checks covering content accessibility, AI-bot access, and agent discovery.',
  },
  {
    key: 'essentials',
    label: 'Web essentials',
    tagline: 'The document fundamentals',
    intro:
      'The document-head fundamentals every page needs — viewport, charset, language, favicon. AI scaffolds routinely skip them because the generated component owns the body and nobody edits the base HTML document.',
    detectorNote: 'Caught by the web-essentials detector — 4 document-head checks.',
  },
]

export const CATEGORY_KEYS: readonly Category[] = CATEGORY_META.map((c) => c.key)

export const isCategory = (slug: string): slug is Category =>
  (CATEGORY_KEYS as readonly string[]).includes(slug)

export const getCategoryMeta = (key: Category): CategoryMeta =>
  CATEGORY_META.find((c) => c.key === key) as CategoryMeta

// Problems in a category, in declaration order (which is deliberate, not alpha).
export const problemsInCategory = (key: Category): readonly Problem[] =>
  ALL_PROBLEMS.filter((p) => p.category === key)

// Resolve `related` slugs to real problems, dropping any that don't exist.
export const resolveRelated = (problem: Problem): readonly Problem[] =>
  problem.related
    .map((slug) => BY_SLUG.get(slug))
    .filter((p): p is Problem => p !== undefined)

// ── Framework variants ───────────────────────────────────────────────────────

export const frameworksFor = (problem: Problem): readonly Framework[] =>
  problem.frameworkFixes
    ? FRAMEWORKS.filter((f) => problem.frameworkFixes?.[f] !== undefined)
    : []

// Every (slug, framework) pair that has a real framework-specific fix — drives
// generateStaticParams for the /fix/[slug]/[framework] route.
export interface FrameworkParam {
  readonly slug: string
  readonly framework: Framework
}

export const getFrameworkParams = (): readonly FrameworkParam[] =>
  ALL_PROBLEMS.flatMap((p) =>
    frameworksFor(p).map((framework) => ({ slug: p.slug, framework })),
  )

// ── Build-time validation ────────────────────────────────────────────────────
// Pure function so a check script (or a future unit test) can assert the data
// dogfoods VibeCheck's own SEO audit: title ≤ 60, description ≤ 160, one h1,
// resolvable related links.

export interface Violation {
  readonly slug: string
  readonly rule: string
}

export const validateProblems = (): readonly Violation[] => {
  const v: Violation[] = []
  for (const p of ALL_PROBLEMS) {
    if (p.title.length > 60) v.push({ slug: p.slug, rule: `title ${p.title.length} > 60` })
    if (p.metaDescription.length > 160)
      v.push({ slug: p.slug, rule: `metaDescription ${p.metaDescription.length} > 160` })
    if (!p.h1.trim()) v.push({ slug: p.slug, rule: 'empty h1' })
    for (const r of p.related)
      if (!BY_SLUG.has(r)) v.push({ slug: p.slug, rule: `related '${r}' not found` })
  }
  return v
}
