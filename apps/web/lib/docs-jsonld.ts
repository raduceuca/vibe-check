import { source } from '@/lib/source'
import { SITE_URL, absoluteUrl } from '@/lib/site'
import {
  AUTHOR_ID,
  DATE_MODIFIED,
  DATE_PUBLISHED,
  ORG_ID,
  WEBSITE_ID,
  organizationNode,
  personNode,
  websiteNode,
  type Json,
} from '@/lib/schema'

// ── Docs JSON-LD ─────────────────────────────────────────────────────────────
// Per-page structured data for every /docs page: TechArticle (headline,
// description, author, published/modified, isPartOf the WebSite) plus a
// BreadcrumbList that mirrors the docs trail. Self-contained — the Organization,
// Person and WebSite nodes travel with each page and share the landing page's
// @ids. This is the AEO surface answer engines read, dogfooding VibeCheck's own
// structured-data + authorship checks.

const titleCase = (segment: string): string =>
  segment
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

// A human name for a partial docs URL: the matching page's title if one exists
// (e.g. /docs/integration → "Integration Guides"), else a title-cased segment.
const nameForUrl = (url: string, segment: string): string => {
  const page = source.getPages().find((p) => p.url === url)
  return page?.data.title ?? titleCase(segment)
}

const breadcrumb = (url: string, leafTitle: string): Json => {
  const items: Json[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Docs', item: absoluteUrl('/docs') },
  ]
  // Everything under /docs — build one crumb per segment, resolving names.
  const segments = url.replace(/^\/docs\/?/, '').split('/').filter(Boolean)
  let acc = '/docs'
  segments.forEach((seg, i) => {
    acc = `${acc}/${seg}`
    const isLeaf = i === segments.length - 1
    items.push({
      '@type': 'ListItem',
      position: i + 3,
      name: isLeaf ? leafTitle : nameForUrl(acc, seg),
      item: absoluteUrl(acc),
    })
  })
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }
}

interface DocPageData {
  readonly title?: string
  readonly description?: string
}

export const buildDocsJsonLd = (page: DocPageData, url: string): readonly Json[] => {
  const headline = page.title ?? 'Documentation'
  const techArticle: Json = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline,
    description: page.description ?? '',
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@id': AUTHOR_ID },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': WEBSITE_ID },
    datePublished: DATE_PUBLISHED,
    dateModified: DATE_MODIFIED,
    inLanguage: 'en',
  }
  return [breadcrumb(url, headline), techArticle, websiteNode, personNode, organizationNode]
}
