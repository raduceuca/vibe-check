import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  CATEGORY_META,
  getAllSlugs,
  getCategoryMeta,
  getProblem,
  isCategory,
} from '@/lib/problems'
import { buildJsonLd } from '@/lib/problems/jsonld'
import { ProblemArticle } from '@/components/fix/ProblemArticle'
import { CategoryView } from '@/components/fix/CategoryView'
import { JsonLd } from '@/components/fix/JsonLd'
import { absoluteUrl } from '@/lib/site'

// One route for both problem pages (/fix/<slug>) and the four category landing
// pages (/fix/performance | seo | aeo | essentials). Category slugs are reserved
// and disjoint from problem slugs, so the branch is unambiguous.

interface Props {
  readonly params: Promise<{ slug: string }>
}

export const dynamicParams = false

export const generateStaticParams = (): { slug: string }[] => [
  ...CATEGORY_META.map((c) => ({ slug: c.key })),
  ...getAllSlugs().map((slug) => ({ slug })),
]

export const generateMetadata = async ({ params }: Props): Promise<Metadata> => {
  const { slug } = await params

  if (isCategory(slug)) {
    const c = getCategoryMeta(slug)
    const title = `${c.label} — fix guides`
    const description = c.intro.slice(0, 160)
    const url = absoluteUrl(`/fix/${slug}`)
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: `/fix/${slug}` },
      openGraph: { title, description, url, type: 'website' },
      twitter: { card: 'summary', title, description },
    }
  }

  const problem = getProblem(slug)
  if (!problem) return {}
  const url = absoluteUrl(`/fix/${slug}`)
  return {
    title: { absolute: problem.title },
    description: problem.metaDescription,
    alternates: { canonical: `/fix/${slug}` },
    openGraph: {
      title: problem.title,
      description: problem.metaDescription,
      url,
      type: 'article',
    },
    twitter: { card: 'summary', title: problem.title, description: problem.metaDescription },
  }
}

const Page = async ({ params }: Props) => {
  const { slug } = await params

  if (isCategory(slug)) {
    return <CategoryView category={getCategoryMeta(slug)} />
  }

  const problem = getProblem(slug)
  if (!problem) notFound()

  const jsonLd = buildJsonLd(problem, absoluteUrl(`/fix/${slug}`))
  return (
    <>
      <JsonLd data={jsonLd} />
      <ProblemArticle problem={problem} />
    </>
  )
}

export default Page
