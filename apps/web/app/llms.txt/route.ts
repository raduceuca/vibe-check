import { CATEGORY_META, problemsInCategory } from '@/lib/problems'
import { source } from '@/lib/source'
import { absoluteUrl } from '@/lib/site'

// /llms.txt — the curated markdown map for LLMs and answer engines: a short
// summary, then every docs page and every /fix guide with a one-line
// description. Served as text/plain, prerendered at build. This is the same
// signal VibeCheck's aeo audit checks for, dogfooded on its own site.

export const dynamic = 'force-static'

const line = (label: string, path: string, desc: string): string =>
  `- [${label}](${absoluteUrl(path)}): ${desc}`

export const GET = (): Response => {
  const sections: string[] = []

  sections.push('# VibeCheck')
  sections.push(
    '> A quiet performance instrument for the AI-built frontend. VibeCheck runs in the corner of your app, catches jank, memory leaks, DOM bloat, layout shift and failing SEO / AI-readiness audits, and hands the evidence to your coding agent over MCP.',
  )

  // Docs
  const docs = source.getPages()
  if (docs.length > 0) {
    sections.push('## Documentation')
    sections.push(
      docs
        .map((p) => line(p.data.title ?? p.url, p.url, p.data.description ?? 'Documentation page.'))
        .join('\n'),
    )
  }

  // Fix guides, grouped by category
  sections.push('## Fix guides')
  sections.push(line('All problems', '/fix', 'Index of every problem VibeCheck catches, grouped by category.'))
  for (const c of CATEGORY_META) {
    sections.push(`### ${c.label}`)
    sections.push(line(`${c.label} overview`, `/fix/${c.key}`, c.tagline))
    sections.push(
      problemsInCategory(c.key)
        .map((p) => line(p.h1, `/fix/${p.slug}`, p.metaDescription))
        .join('\n'),
    )
  }

  const body = sections.join('\n\n') + '\n'
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
