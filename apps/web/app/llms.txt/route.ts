import { CATEGORY_META, problemsInCategory } from '@/lib/problems'
import { source } from '@/lib/source'
import { absoluteUrl } from '@/lib/site'

// /llms.txt — the curated markdown map for LLMs and answer engines, per the
// llmstxt.org spec: an H1, a `>` blockquote summary, then link sections. Every
// link points at the page's `.md` view so an agent that follows one lands in
// clean markdown, not HTML. Served as text/plain, prerendered at build. This is
// the same signal VibeCheck's aeo audit checks for, dogfooded on its own site.

export const dynamic = 'force-static'

// A link to the `.md` view of a page.
const line = (label: string, path: string, desc: string): string =>
  `- [${label}](${absoluteUrl(`${path}.md`)}): ${desc}`

export const GET = (): Response => {
  const sections: string[] = []

  sections.push('# VibeCheck')
  sections.push(
    '> A quiet performance instrument for the AI-built frontend. VibeCheck runs in the corner of your app, catches jank, memory leaks, DOM bloat, layout shift and failing SEO / AI-readiness audits, and hands the evidence to your coding agent over MCP.',
  )
  sections.push(
    'Every link below points at a clean markdown version of the page. Read them directly, or fetch the whole site at once via /llms-full.txt.',
  )

  // Docs
  const docs = source.getPages()
  if (docs.length > 0) {
    sections.push('## Docs')
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

  // Optional — machine-readable resources that aren't core reading.
  sections.push('## Optional')
  sections.push(
    [
      `- [Full markdown corpus](${absoluteUrl('/llms-full.txt')}): every doc and fix guide concatenated into one file.`,
      `- [Sitemap](${absoluteUrl('/sitemap.xml')}): every canonical URL on the site.`,
      `- [MCP server card](${absoluteUrl('/.well-known/mcp.json')}): the agent interface (six tools) VibeCheck exposes.`,
    ].join('\n'),
  )

  const body = sections.join('\n\n') + '\n'
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
