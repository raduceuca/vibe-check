import type { CodeBlock, Framework, Problem } from './types'
import { CATEGORY_LABELS, FRAMEWORK_LABELS } from './types'
import {
  CATEGORY_META,
  frameworksFor,
  problemsInCategory,
  resolveRelated,
  type CategoryMeta,
} from './index'
import { absoluteUrl } from '../site'

// ── Markdown views of the /fix content ───────────────────────────────────────
// Generates a clean markdown representation of every fix surface — one problem,
// a framework variant, a category, and the hub — from the same `Problem` data
// that renders the HTML pages. Served at `<path>.md` and via `Accept:
// text/markdown` so agents read the fix without scraping the DOM. This is the
// dogfood of VibeCheck's own markdown-negotiation aeo check.

const FENCE = '```'

// A markdown link to the `.md` view of a fix page, so cross-links keep agents in
// the markdown graph rather than bouncing them back into HTML.
const mdFixUrl = (slug: string): string => absoluteUrl(`/fix/${slug}.md`)

const codeBlock = (b: CodeBlock): string => {
  const caption = b.caption ? `_${b.caption}_\n\n` : ''
  return `${caption}${FENCE}${b.lang}\n${b.code}\n${FENCE}`
}

const codeBlocks = (blocks: readonly CodeBlock[]): string => blocks.map(codeBlock).join('\n\n')

const bullets = (items: readonly string[]): string => items.map((i) => `- ${i}`).join('\n')

const detectionSection = (problem: Problem): string =>
  [
    '## How VibeCheck detects it',
    '',
    `The \`${problem.detection.detector}\` detector flags this live in the browser and reports it to the widget's Problems list — and to your coding agent over MCP.`,
    '',
    `- **Issue string:** \`${problem.detection.issueString}\``,
    `- **Threshold:** ${problem.detection.threshold}`,
  ].join('\n')

const faqSection = (problem: Problem): string | null => {
  if (problem.faq.length === 0) return null
  const items = problem.faq.map((f) => `### ${f.q}\n\n${f.a}`).join('\n\n')
  return `## FAQ\n\n${items}`
}

const relatedSection = (problem: Problem): string | null => {
  const related = resolveRelated(problem)
  if (related.length === 0) return null
  const items = related
    .map((r) => `- [${r.h1}](${mdFixUrl(r.slug)}) — ${CATEGORY_LABELS[r.category]}`)
    .join('\n')
  return `## Related problems\n\n${items}`
}

const frameworkFixesSection = (problem: Problem): string | null => {
  const frameworks = frameworksFor(problem)
  if (frameworks.length === 0) return null
  const blocks = frameworks.map((f) => {
    const fix = problem.frameworkFixes?.[f]
    if (!fix) return ''
    const docs = fix.docsUrl ? `\n\n[${FRAMEWORK_LABELS[f]} docs](${fix.docsUrl})` : ''
    return `### ${FRAMEWORK_LABELS[f]}\n\n${fix.note}\n\n${codeBlocks(fix.code)}${docs}`
  })
  return `## Framework-specific fixes\n\n${blocks.join('\n\n')}`
}

const metaLine = (problem: Problem): string => {
  const check = problem.checkId ? ` · Check \`${problem.checkId}\`` : ''
  return `_Category: ${CATEGORY_LABELS[problem.category]} · Detector \`${problem.detector}\`${check} · Severity: ${problem.severity}_`
}

const footer = (slug: string): string =>
  `---\n\nFix guide from VibeCheck — ${absoluteUrl(`/fix/${slug}`)}. Full site index for LLMs: ${absoluteUrl('/llms.txt')}`

// The general, framework-agnostic problem page as markdown.
const generalMarkdown = (problem: Problem): string => {
  const parts: (string | null)[] = [
    `# ${problem.h1}`,
    `> ${problem.metaDescription}`,
    metaLine(problem),
    problem.pain,
    `## Symptoms\n\n${bullets(problem.symptoms)}`,
    detectionSection(problem),
    `## Root causes\n\n${bullets(problem.rootCauses)}`,
    fixSection(problem),
    frameworkFixesSection(problem),
    faqSection(problem),
    relatedSection(problem),
    footer(problem.slug),
  ]
  return parts.filter((p): p is string => p !== null).join('\n\n') + '\n'
}

const fixSection = (problem: Problem): string => {
  const steps = problem.fix.steps
    ? `\n\n### Steps\n\n${problem.fix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''
  const code = problem.fix.code.length > 0 ? `\n\n${codeBlocks(problem.fix.code)}` : ''
  return `## The fix\n\n${problem.fix.summary}${steps}${code}`
}

// The framework variant page (/fix/<slug>/<framework>) as markdown.
const frameworkMarkdown = (problem: Problem, framework: Framework): string => {
  const fix = problem.frameworkFixes?.[framework]
  if (!fix) return generalMarkdown(problem)
  const label = FRAMEWORK_LABELS[framework]
  const docs = fix.docsUrl ? `\n\n[${label} docs](${fix.docsUrl})` : ''
  const steps = problem.fix.steps
    ? `\n\n### Steps\n\n${problem.fix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
    : ''
  const parts: (string | null)[] = [
    `# ${problem.h1} in ${label}`,
    `> How to fix ${problem.h1.toLowerCase()} in ${label} — with the exact fix and copy-paste code.`,
    metaLine(problem),
    problem.pain,
    `## The fix for ${label}\n\n${fix.note}\n\n${codeBlocks(fix.code)}${docs}${steps}`,
    detectionSection(problem),
    faqSection(problem),
    `See the general, framework-agnostic fix: ${mdFixUrl(problem.slug)}`,
    footer(problem.slug),
  ]
  return parts.filter((p): p is string => p !== null).join('\n\n') + '\n'
}

// Public: the markdown for a problem, optionally specialised for a framework.
export const problemToMarkdown = (problem: Problem, framework?: Framework): string =>
  framework ? frameworkMarkdown(problem, framework) : generalMarkdown(problem)

// Public: a category landing page as markdown — intro plus a linked list of
// every problem in the pillar.
export const categoryToMarkdown = (category: CategoryMeta): string => {
  const problems = problemsInCategory(category.key)
  const list = problems.map((p) => `- [${p.h1}](${mdFixUrl(p.slug)}): ${p.metaDescription}`).join('\n')
  return (
    [
      `# ${category.label}`,
      `> ${category.tagline}`,
      category.intro,
      category.detectorNote,
      `## Problems in this category\n\n${list}`,
      `---\n\nCategory index from VibeCheck — ${absoluteUrl(`/fix/${category.key}`)}. Full site index for LLMs: ${absoluteUrl('/llms.txt')}`,
    ].join('\n\n') + '\n'
  )
}

// Public: the /fix hub as markdown — intro plus every problem grouped by category.
export const fixHubToMarkdown = (): string => {
  const sections = CATEGORY_META.map((c) => {
    const list = problemsInCategory(c.key)
      .map((p) => `- [${p.h1}](${mdFixUrl(p.slug)}): ${p.metaDescription}`)
      .join('\n')
    return `## ${c.label}\n\n${c.intro}\n\n${list}`
  })
  return (
    [
      '# Fix guides — every problem VibeCheck catches',
      '> Field guides for every performance, SEO, AI-readiness and web-essentials problem VibeCheck detects in AI-built frontends — with the exact fix and code.',
      "VibeCheck runs in the corner of your app and catches what an AI agent quietly broke: jank, leaks, DOM bloat, layout shift, and failing SEO / AI-readiness audits. Every issue it can emit has a guide here — what it is, why it hurts, the literal string the detector reports, and the fix with code, per framework.",
      ...sections,
      `---\n\nFix hub from VibeCheck — ${absoluteUrl('/fix')}. Full site index for LLMs: ${absoluteUrl('/llms.txt')}`,
    ].join('\n\n') + '\n'
  )
}
