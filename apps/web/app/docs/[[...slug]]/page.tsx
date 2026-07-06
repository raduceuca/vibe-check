import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  DocsPage,
  DocsBody,
  DocsTitle,
  DocsDescription,
} from 'fumadocs-ui/layouts/docs/page'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/components/mdx'
import { JsonLd } from '@/components/JsonLd'
import { buildDocsJsonLd } from '@/lib/docs-jsonld'
import { absoluteUrl } from '@/lib/site'

interface DocsPageProps {
  readonly params: Promise<{ slug?: string[] }>
}

const Page = async ({ params }: DocsPageProps) => {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const MDX = page.data.body
  const jsonLd = buildDocsJsonLd(page.data, absoluteUrl(page.url))

  return (
    <>
      <JsonLd data={jsonLd} />
      {/* A <main> landmark for assistants and the aeo audit's no-main-landmark
          check. display:contents keeps fumadocs' grid intact — its <article>
          stays a direct grid child, so [grid-area:main] still applies. */}
      <main style={{ display: 'contents' }}>
        <DocsPage toc={page.data.toc} full={page.data.full}>
          <DocsTitle>{page.data.title}</DocsTitle>
          <DocsDescription>{page.data.description}</DocsDescription>
          <DocsBody>
            <MDX components={getMDXComponents()} />
          </DocsBody>
        </DocsPage>
      </main>
    </>
  )
}

export default Page

export const generateStaticParams = () => source.generateParams()

export const generateMetadata = async ({
  params,
}: DocsPageProps): Promise<Metadata> => {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
      types: { 'text/markdown': `${page.url}.md` },
    },
  }
}
