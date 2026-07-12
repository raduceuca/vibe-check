import {
  CATEGORY_LABELS,
  getFrameworkParams,
  getProblem,
} from '@/lib/problems'
import { FRAMEWORK_LABELS, type Framework } from '@/lib/problems/types'
import { OG_SIZE, OG_CONTENT_TYPE, renderOgImage } from '@/lib/problems/og'

// OG image for the framework variants /fix/<slug>/<framework>. Generated only for
// the (problem, framework) pairs that carry a real framework-specific fix — the
// same set the page's generateStaticParams declares.

export const runtime = 'nodejs'
export const dynamicParams = false
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE
export const alt = 'VibeCheck fix guide'

export const generateStaticParams = (): { slug: string; framework: string }[] =>
  getFrameworkParams().map((p) => ({ slug: p.slug, framework: p.framework }))

interface Props {
  readonly params: Promise<{ slug: string; framework: string }>
}

const Image = async ({ params }: Props) => {
  const { slug, framework } = await params
  const problem = getProblem(slug)
  const label = FRAMEWORK_LABELS[framework as Framework]

  if (!problem || !label) {
    return renderOgImage({
      kicker: 'Fix guides',
      title: 'Catch what your agent broke',
      footer: 'vibecheck.dev/fix',
    })
  }

  return renderOgImage({
    kicker: `${CATEGORY_LABELS[problem.category]} · ${label}`,
    title: problem.h1,
    severity: problem.severity,
    footer: 'vibecheck.dev/fix',
    tag: `Fix guide · ${label}`,
  })
}

export default Image
