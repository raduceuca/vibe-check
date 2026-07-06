import type { Problem } from './types'
import { CATEGORY_LABELS, FRAMEWORK_LABELS } from './types'
import { SITE_NAME, SITE_URL, absoluteUrl } from '../site'

// ── JSON-LD builders ─────────────────────────────────────────────────────────
// Emits schema.org structured data for every /fix page. TechArticle describes
// the guide, HowTo captures the fix steps (when present), FAQPage feeds answer
// engines from the problem's FAQ, and BreadcrumbList mirrors the on-page trail.
// This is the AEO surface — the same structured data VibeCheck's aeo audit looks
// for, dogfooded on its own content.

// A loose JSON value type — JSON-LD is plain data serialized into a script tag.
type Json = string | number | boolean | null | Json[] | { readonly [k: string]: Json }

const organization = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
} as const

const breadcrumb = (problem: Problem, url: string, framework?: string): Json => {
  const items: Json[] = [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Fix guides', item: absoluteUrl('/fix') },
    {
      '@type': 'ListItem',
      position: 3,
      name: CATEGORY_LABELS[problem.category],
      item: absoluteUrl(`/fix/${problem.category}`),
    },
    {
      '@type': 'ListItem',
      position: 4,
      name: problem.h1,
      item: absoluteUrl(`/fix/${problem.slug}`),
    },
  ]
  if (framework) {
    items.push({
      '@type': 'ListItem',
      position: 5,
      name: FRAMEWORK_LABELS[framework as keyof typeof FRAMEWORK_LABELS] ?? framework,
      item: url,
    })
  }
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items }
}

const techArticle = (problem: Problem, url: string): Json => ({
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: problem.title,
  description: problem.metaDescription,
  url,
  mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  author: organization,
  publisher: organization,
  about: `${CATEGORY_LABELS[problem.category]} — ${problem.detector}`,
  keywords: [problem.slug.replace(/-/g, ' '), problem.category, problem.detector].join(', '),
})

const howTo = (problem: Problem, url: string): Json | null => {
  const steps = problem.fix.steps
  if (!steps || steps.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: problem.h1,
    description: problem.fix.summary,
    url,
    step: steps.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      text,
    })),
  }
}

const faqPage = (problem: Problem): Json | null => {
  if (problem.faq.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: problem.faq.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

// The full array of JSON-LD objects for a problem page (canonical or framework
// variant). Rendered into a single <script type="application/ld+json">.
export const buildJsonLd = (
  problem: Problem,
  url: string,
  framework?: string,
): readonly Json[] => {
  const graph: Json[] = [breadcrumb(problem, url, framework), techArticle(problem, url)]
  const ht = howTo(problem, url)
  if (ht) graph.push(ht)
  const faq = faqPage(problem)
  if (faq) graph.push(faq)
  return graph
}
