import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { Framework } from '@/lib/problems/types'
import { FRAMEWORK_LABELS } from '@/lib/problems/types'
import { getFrameworkParams, getProblem } from '@/lib/problems'
import { buildJsonLd } from '@/lib/problems/jsonld'
import { ProblemArticle } from '@/components/fix/ProblemArticle'
import { JsonLd } from '@/components/fix/JsonLd'
import { absoluteUrl } from '@/lib/site'

// Framework variants: /fix/<slug>/<framework>. Only generated for the (problem,
// framework) pairs that carry a real framework-specific fix — see
// getFrameworkParams(). Same template, with the framework fix surfaced.

interface Props {
  readonly params: Promise<{ slug: string; framework: string }>
}

export const dynamicParams = false

export const generateStaticParams = (): { slug: string; framework: string }[] =>
  getFrameworkParams().map((p) => ({ slug: p.slug, framework: p.framework }))

const clamp = (s: string, max: number): string => (s.length <= max ? s : s.slice(0, max - 1).trimEnd())

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug, framework } = await params
  const problem = getProblem(slug)
  if (!problem || !problem.frameworkFixes?.[framework as Framework]) return {}

  const label = FRAMEWORK_LABELS[framework as Framework]
  const title = clamp(`${problem.h1} in ${label}`, 60)
  const description = clamp(`How to fix ${problem.h1.toLowerCase()} in ${label} — with copy-paste code and the exact fix.`, 160)
  const path = `/fix/${slug}/${framework}`
  const url = absoluteUrl(path)
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const Page = async ({ params }: Props) => {
  const { slug, framework } = await params
  const problem = getProblem(slug)
  if (!problem || !problem.frameworkFixes?.[framework as Framework]) notFound()

  const fw = framework as Framework
  const jsonLd = buildJsonLd(problem, absoluteUrl(`/fix/${slug}/${framework}`), framework)
  return (
    <>
      <JsonLd data={jsonLd} />
      <ProblemArticle problem={problem} framework={fw} />
    </>
  )
}

export default Page
