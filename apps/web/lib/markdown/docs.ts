import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { source } from '@/lib/source'

// ── Docs MDX → clean markdown ────────────────────────────────────────────────
// Turns a docs page's source `.mdx` into agent-readable markdown: strips the
// frontmatter and MDX imports, converts <Card/> to links and <Callout> to
// prose, drops diagram/widget component tags — but never touches code fences,
// which legitimately contain JSX examples. Read at build (force-static route),
// so `fs` access is safe. Dogfoods VibeCheck's markdown-negotiation aeo check.

const DOCS_DIR = join(process.cwd(), 'content', 'docs')

// Map a docs page URL (/docs, /docs/quickstart, /docs/integration) to its source
// file, resolving both flat pages and folder index pages.
const relPathForUrl = (url: string): string | null => {
  const rel = url.replace(/^\/docs\/?/, '')
  const flat = rel === '' ? 'index.mdx' : `${rel}.mdx`
  if (existsSync(join(DOCS_DIR, flat))) return flat
  if (rel !== '') {
    const nested = `${rel}/index.mdx`
    if (existsSync(join(DOCS_DIR, nested))) return nested
  }
  return null
}

const attr = (attrs: string, name: string): string | undefined => {
  const m = attrs.match(new RegExp(`${name}=["']([^"']*)["']`))
  return m ? m[1] : undefined
}

// <Card title href description /> → a markdown link, pointing at the `.md` view
// of internal targets so the agent stays in the markdown graph.
const cardToLink = (attrs: string): string => {
  const title = attr(attrs, 'title') ?? 'Read more'
  const href = attr(attrs, 'href') ?? '#'
  const description = attr(attrs, 'description')
  const url = href.startsWith('/') ? `${href}.md` : href
  return `- [${title}](${url})${description ? `: ${description}` : ''}`
}

// Transform a prose (non-code-fence) segment: drop MDX imports and JSX tags,
// keeping the human-readable text and any converted links.
const transformProse = (segment: string): string =>
  segment
    // MDX import statements (single- or multi-line), e.g. `import { X } from '@/...'`
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?[^\n]*$/gm, '')
    // <Card ... /> → link
    .replace(/<Card\b([^>]*?)\/>/g, (_m, a: string) => cardToLink(a))
    // <Cards> wrappers → drop, keep the converted card links inside
    .replace(/<\/?Cards>/g, '')
    // <Callout title="X"> → surface the title as bold prose; </Callout> → drop
    .replace(/<Callout\b([^>]*)>/g, (_m, a: string) => {
      const t = attr(a, 'title')
      return t ? `**${t}**\n` : ''
    })
    .replace(/<\/Callout>/g, '')
    // Any remaining self-closing capitalised component (diagrams, live widgets)
    .replace(/<[A-Z][A-Za-z0-9]*\b[^>]*\/>/g, '')
    // Any remaining paired capitalised component tags → drop tag, keep inner text
    .replace(/<\/?[A-Z][A-Za-z0-9]*\b[^>]*>/g, '')

// Transform only outside code — both fenced blocks and inline `code` spans keep
// their JSX examples verbatim (e.g. a `<VibeCheck />` reference in prose).
const transformOutsideFences = (content: string): string => {
  const parts = content.split(/(```[\s\S]*?```|`[^`\n]*`)/g)
  const joined = parts.map((part, i) => (i % 2 === 1 ? part : transformProse(part))).join('')
  return joined.replace(/\n{3,}/g, '\n\n').trim()
}

interface ParsedMdx {
  readonly title?: string
  readonly description?: string
  readonly body: string
}

const stripQuotes = (s: string): string => s.trim().replace(/^['"]|['"]$/g, '')

const parseMdx = (raw: string): ParsedMdx => {
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!fm) return { body: transformOutsideFences(raw) }
  const yaml = fm[1]
  const title = yaml.match(/^title:\s*(.+)$/m)?.[1]
  const description = yaml.match(/^description:\s*(.+)$/m)?.[1]
  return {
    title: title ? stripQuotes(title) : undefined,
    description: description ? stripQuotes(description) : undefined,
    body: transformOutsideFences(raw.slice(fm[0].length)),
  }
}

// Public: a docs page as clean markdown, or null if the URL has no source file.
export const docsPageToMarkdown = (url: string): string | null => {
  const rel = relPathForUrl(url)
  if (!rel) return null
  let raw: string
  try {
    raw = readFileSync(join(DOCS_DIR, rel), 'utf8')
  } catch {
    return null
  }
  const { title, description, body } = parseMdx(raw)
  const head = `# ${title ?? url}${description ? `\n\n> ${description}` : ''}`
  return `${head}\n\n${body}\n`
}

// Public: every docs page URL, for enumeration in llms.txt / llms-full.txt and
// the markdown route's static params.
export const allDocsUrls = (): readonly string[] => source.getPages().map((p) => p.url)
