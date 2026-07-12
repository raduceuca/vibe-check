import { ALL_PROBLEMS } from '@/lib/problems'

// ── Miss → fix guide ─────────────────────────────────────────────────────────
// Every seo/aeo/essentials problem carries a `checkId`; this derives the single
// source-of-truth map from the problem catalog so a failing scan check links
// straight to its /fix/<slug> guide. Falls back to the category hub when a check
// has no dedicated guide.

const HREF_BY_CHECK: ReadonlyMap<string, string> = new Map(
  ALL_PROBLEMS.filter((p) => p.checkId !== undefined).map((p) => [
    p.checkId as string,
    `/fix/${p.slug}`,
  ]),
)

const CATEGORY_HUB: Record<'seo' | 'aeo', string> = {
  seo: '/fix/seo',
  aeo: '/fix/aeo',
}

export const fixHrefForCheck = (checkId: string, category: 'seo' | 'aeo'): string =>
  HREF_BY_CHECK.get(checkId) ?? CATEGORY_HUB[category]
