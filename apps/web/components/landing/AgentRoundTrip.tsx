'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Scripted agent round-trip ────────────────────────────────────────────────
// A terminal-style panel that plays the realistic symptom→fix exchange: VibeCheck
// illustrates a DOM-bloat issue that a coding agent can receive over MCP
// (get_detected_issues), asks for a fix (get_fix_suggestions → a real unified
// and closes the loop (resolve_issue). This transcript is illustrative; the
// public landing widget intentionally runs without a local beacon.
//
// Playback types the agent's half line-by-line; the caught issue is shown at rest
// so the panel is never empty. Honors prefers-reduced-motion by rendering the
// full transcript instantly (no essential content is motion-only).

type RowKind =
  | 'sys'
  | 'issue'
  | 'cmd'
  | 'out'
  | 'diff-meta'
  | 'diff-hunk'
  | 'diff-ctx'
  | 'diff-add'
  | 'diff-del'
  | 'ok'
  | 'gap'

interface Row {
  readonly kind: RowKind
  readonly text: string
  readonly prefix?: string
  readonly typed?: boolean
}

// Rows flagged `intro` are shown statically at rest (the caught issue); Play
// animates everything after them (the agent's round-trip).
const INTRO_COUNT = 3

const ROWS: readonly Row[] = [
  { kind: 'sys', text: '// Illustrative local session — the public demo is local-only' },
  { kind: 'issue', prefix: '● ', text: 'dom-bloat · warning   1,240 nodes — <Testimonials> renders every card' },
  { kind: 'gap', text: '' },
  { kind: 'cmd', prefix: 'claude ▸ ', text: "watch_for_issue({ project_id: 'storefront' })", typed: true },
  { kind: 'out', text: '→ 1 issue' },
  { kind: 'out', text: '[' },
  { kind: 'out', text: '  {' },
  { kind: 'out', text: '    "id": "dom-bloat:node-count",' },
  { kind: 'out', text: '    "detector": "dom-bloat",' },
  { kind: 'out', text: '    "severity": "warning",' },
  { kind: 'out', text: '    "title": "Large DOM detected",' },
  { kind: 'out', text: '    "evidence": { "nodeCount": 1240, "maxDepth": 18 }' },
  { kind: 'out', text: '  }' },
  { kind: 'out', text: ']' },
  { kind: 'gap', text: '' },
  { kind: 'cmd', prefix: 'claude ▸ ', text: "get_fix_suggestions({ project_id: 'storefront', issue_id: 'dom-bloat:node-count' })", typed: true },
  { kind: 'out', text: '→ render only the visible testimonial window:' },
  { kind: 'diff-meta', text: '--- a/components/Testimonials.tsx' },
  { kind: 'diff-meta', text: '+++ b/components/Testimonials.tsx' },
  { kind: 'diff-hunk', text: '@@ -18,3 +18,3 @@ export const Testimonials = () => (' },
  { kind: 'diff-del', text: '-      {testimonials.map(renderCard)}' },
  { kind: 'diff-add', text: '+      {visibleTestimonials.map(renderCard)}' },
  { kind: 'gap', text: '' },
  { kind: 'cmd', prefix: 'claude ▸ ', text: "resolve_issue({ project_id: 'storefront', issue_id: 'dom-bloat:node-count' })", typed: true },
  { kind: 'ok', prefix: '✓ ', text: 'resolved — DOM returned below the warning threshold.' },
]

const CHAR_MS = 18
const ROW_MS = 190
const CMD_TAIL_MS = 260

type Phase = 'idle' | 'playing' | 'done'

export const AgentRoundTrip = () => {
  const [shown, setShown] = useState(INTRO_COUNT)
  const [typing, setTyping] = useState<{ readonly i: number; readonly n: number } | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const timer = useRef<number | null>(null)
  const reduced = useRef(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const started = useRef(false)

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  // Detect reduced-motion preference once mounted; if set, reveal everything.
  useEffect(() => {
    reduced.current =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    if (reduced.current) {
      setShown(ROWS.length)
      setPhase('done')
    }
    return clearTimer
  }, [clearTimer])

  const advance = useCallback(
    (i: number) => {
      if (i >= ROWS.length) {
        setTyping(null)
        setShown(ROWS.length)
        setPhase('done')
        return
      }
      const row = ROWS[i]
      if (row.typed) {
        const tick = (n: number) => {
          if (n > row.text.length) {
            setTyping(null)
            setShown(i + 1)
            timer.current = window.setTimeout(() => advance(i + 1), CMD_TAIL_MS)
            return
          }
          setTyping({ i, n })
          timer.current = window.setTimeout(() => tick(n + 1), CHAR_MS)
        }
        setTyping({ i, n: 0 })
        timer.current = window.setTimeout(() => tick(1), ROW_MS)
      } else {
        setShown(i + 1)
        timer.current = window.setTimeout(() => advance(i + 1), row.kind === 'gap' ? 70 : ROW_MS)
      }
    },
    [],
  )

  const play = useCallback(() => {
    clearTimer()
    if (reduced.current) {
      setShown(ROWS.length)
      setPhase('done')
      return
    }
    setTyping(null)
    setShown(INTRO_COUNT)
    setPhase('playing')
    timer.current = window.setTimeout(() => advance(INTRO_COUNT), 320)
  }, [advance, clearTimer])

  // Auto-play by default once the panel scrolls into view — the round-trip runs
  // on its own, not only on click. Fires once; reduced-motion (already revealed)
  // and an unsupported IntersectionObserver both skip straight past.
  useEffect(() => {
    const el = rootRef.current
    if (!el || started.current || reduced.current) return
    if (typeof IntersectionObserver === 'undefined') {
      started.current = true
      play()
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !started.current) {
          started.current = true
          play()
          io.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [play])

  const label = phase === 'playing' ? 'Playing…' : phase === 'done' ? 'Replay' : 'Send to your agent'

  return (
    <div ref={rootRef} className="vc-term" role="group" aria-label="Scripted VibeCheck to agent round-trip over MCP">
      <div className="vc-term-bar">
        <span className="vc-term-dots" aria-hidden="true">
          <span className="vc-term-dot" />
          <span className="vc-term-dot" />
          <span className="vc-term-dot" />
        </span>
        <span className="vc-term-title">agent ⇄ vibe-check · MCP</span>
        <button
          type="button"
          className="vc-term-play"
          onClick={play}
          disabled={phase === 'playing'}
        >
          {label}
        </button>
      </div>

      <div className="vc-term-body">
        {ROWS.map((row, i) => {
          const isTyping = typing?.i === i
          const visible = i < shown || isTyping
          const content = isTyping ? row.text.slice(0, typing.n) : row.text
          return (
            <div
              key={i}
              className="vc-term-row"
              data-kind={row.kind}
              data-shown={visible}
            >
              {row.prefix ? <span className="vc-term-pre">{row.prefix}</span> : null}
              {content}
              {isTyping ? <span className="vc-term-cursor" aria-hidden="true" /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
