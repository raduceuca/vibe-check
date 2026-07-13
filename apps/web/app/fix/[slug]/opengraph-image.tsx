import {
  CATEGORY_LABELS,
  CATEGORY_META,
  getAllSlugs,
  getCategoryMeta,
  getProblem,
  isCategory,
} from '@/lib/problems'
import { OG_SIZE, OG_CONTENT_TYPE, renderOgImage } from '@/lib/problems/og'

// OG image for /fix/<slug>. Covers both branches the page serves: the four
// category landing pages and the individual problem pages. Statically generated
// for every param the page declares, so no image is ever missing.

export const runtime = 'nodejs'
export const dynamicParams = false
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'VibeCheck fix guide'

export const generateStaticParams = (): { slug: string }[] => [
  ...CATEGORY_META.map((c) => ({ slug: c.key })),
  ...getAllSlugs().map((slug) => ({ slug })),
]

interface Props {
  readonly params: Promise<{ slug: string }>
}

const Image = async ({ params }: Props) => {
  const { slug } = await params

  if (isCategory(slug)) {
    const c = getCategoryMeta(slug)
    return renderOgImage({
      kicker: c.label,
      title: c.tagline,
      footer: 'vibecheck.wcgw.fun/fix',
      tag: 'Fix guides',
    })
  }

  const problem = getProblem(slug)
  if (!problem) {
    return renderOgImage({
      kicker: 'Fix guides',
      title: 'Catch what your agent broke',
      footer: 'vibecheck.wcgw.fun/fix',
    })
  }

  return renderOgImage({
    kicker: CATEGORY_LABELS[problem.category],
    title: problem.h1,
    severity: problem.severity,
    footer: 'vibecheck.wcgw.fun/fix',
    tag: 'Fix guide',
  })
}

export default Image
