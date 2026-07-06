import { Fragment, type ReactNode } from 'react'
import type { CodeBlock } from '@/lib/problems/types'

// ── Monochrome code highlighting ─────────────────────────────────────────────
// The Quiet Instrument palette reserves colour for a caught fault, so code is
// highlighted in neutrals only: comments dimmed, strings de-emphasised, a small
// keyword set weighted. Tokenised at render time (Server Component) — zero
// client JS. Robust by construction: strings are matched before line comments,
// so a "//" inside a URL or string is never mistaken for a comment.

const MARKUP_COMMENT = new Set(['html', 'xml', 'vue', 'svelte'])
const BLOCK_COMMENT = new Set(['js', 'ts', 'tsx', 'jsx', 'css', 'vue', 'svelte'])
const SLASH_COMMENT = new Set(['js', 'ts', 'tsx', 'jsx', 'vue', 'svelte'])
const HASH_COMMENT = new Set(['bash'])

const KEYWORDS = [
  'import', 'from', 'export', 'default', 'const', 'let', 'var', 'function',
  'return', 'async', 'await', 'new', 'class', 'extends', 'interface', 'type',
  'if', 'else', 'for', 'while', 'try', 'catch', 'throw', 'this',
]
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'g')

const buildTokenRe = (lang: string): RegExp => {
  const parts: string[] = []
  if (MARKUP_COMMENT.has(lang)) parts.push('<!--[\\s\\S]*?-->')
  if (BLOCK_COMMENT.has(lang)) parts.push('/\\*[\\s\\S]*?\\*/')
  // strings first among the single-char openers so "//" inside a string/URL is
  // consumed as string, never read as a comment.
  parts.push('`(?:[^`\\\\]|\\\\.)*`', '"(?:[^"\\\\]|\\\\.)*"', "'(?:[^'\\\\]|\\\\.)*'")
  if (SLASH_COMMENT.has(lang)) parts.push('//[^\\n]*')
  if (HASH_COMMENT.has(lang)) parts.push('#[^\\n]*')
  return new RegExp(parts.join('|'), 'g')
}

const isComment = (t: string): boolean =>
  t.startsWith('//') || t.startsWith('/*') || t.startsWith('<!--') || t.startsWith('#')

// Bold the small keyword set inside a run of plain (non-string, non-comment) code.
const withKeywords = (text: string, keyPrefix: string): ReactNode[] => {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  KEYWORD_RE.lastIndex = 0
  let i = 0
  while ((m = KEYWORD_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(
      <span className="vc-tk-k" key={`${keyPrefix}-k${i++}`}>
        {m[0]}
      </span>,
    )
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const highlight = (code: string, lang: string): ReactNode[] => {
  const re = buildTokenRe(lang)
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(code)) !== null) {
    if (m.index > last) nodes.push(...withKeywords(code.slice(last, m.index), `p${i}`))
    const tok = m[0]
    nodes.push(
      <span className={isComment(tok) ? 'vc-tk-c' : 'vc-tk-s'} key={`t${i++}`}>
        {tok}
      </span>,
    )
    last = m.index + tok.length
  }
  if (last < code.length) nodes.push(...withKeywords(code.slice(last), `p${i}`))
  return nodes
}

export const CodeBlockView = ({ block }: { block: CodeBlock }) => (
  <figure className="vc-codeblock">
    <figcaption className="vc-codeblock-head">
      {block.caption ? <span className="vc-codeblock-cap">{block.caption}</span> : <span />}
      <span className="vc-codeblock-lang">{block.lang}</span>
    </figcaption>
    <pre className="vc-pre">
      <code>
        {highlight(block.code, block.lang).map((n, i) => (
          <Fragment key={i}>{n}</Fragment>
        ))}
      </code>
    </pre>
  </figure>
)

export const CodeBlockList = ({ blocks }: { blocks: readonly CodeBlock[] }) => (
  <>
    {blocks.map((b, i) => (
      <CodeBlockView block={b} key={i} />
    ))}
  </>
)
