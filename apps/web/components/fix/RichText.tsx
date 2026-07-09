import { Fragment, type ReactNode } from 'react'

// ── Inline code formatting for prose ─────────────────────────────────────────
// Promotes code fragments inside a plain prose string to inline <code> chips
// (.vc-code). Two triggers, in priority order:
//   1. explicit backtick spans  — `document.title` → <code>document.title</code>
//   2. bare HTML-tag-like runs   — <title></title>  → <code><title></code><code></title></code>
// Backtick spans are matched first so a tag already wrapped in backticks is
// emitted once, never double-wrapped. Angle brackets don't occur in ordinary
// prose, so the bare-tag rule is safe. Server Component — no client JS.

const TOKEN_RE = /`([^`]+)`|(<[^>]+>)/g

export const RichText = ({ text }: { text: string }) => {
  const parts: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    parts.push(<code className="vc-code">{match[1] ?? match[2]}</code>)
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  )
}
