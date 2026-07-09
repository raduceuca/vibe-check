import type { Problem } from '@/lib/problems/types'
import { ISSUE_ART } from '@/components/issueArt'
import { SeverityTag } from './SeverityTag'

// ── The catch → hand-off panel ───────────────────────────────────────────────
// Dramatizes VibeCheck's core loop for one problem, replacing the old prose +
// bare issue bar. Two stacked stages inside one bordered capture panel:
//   1. Caught in the widget — the detector's glyph, a severity tag, the detector
//      name in mono, and the literal issue string in the fault-red .vc-emit box,
//      echoing the widget's Problems list.
//   2. Read by the agent (MCP) — a calm terminal readout of the same issue,
//      structured as the agent sees it over get_detected_issues.
// The issue string is identical in both halves — that's the whole point — so it
// is tinted with the signal red in the MCP readout to tie the two together.
// Server Component — no client JS; reusable for all 43 problems.

export const CatchPanel = ({ problem }: { problem: Problem }) => {
  const Art = ISSUE_ART[problem.detector]
  const { detector, issueString, threshold } = problem.detection

  return (
    <div
      className="vc-catch"
      role="group"
      aria-label="How VibeCheck catches this issue and hands it to your agent"
    >
      {/* Stage 1 — caught in the widget's Problems list */}
      <div className="vc-catch-stage">
        <p className="vc-catch-label">
          In your widget <span className="vc-catch-label-sub">· Problems</span>
        </p>
        <div className="vc-catch-row">
          {Art ? (
            <span className="vc-catch-art" aria-hidden="true">
              <Art />
            </span>
          ) : null}
          <span className="vc-catch-row-body">
            <span className="vc-catch-row-meta">
              <SeverityTag severity={problem.severity} />
              <span className="vc-catch-detector">{detector}</span>
            </span>
            <span className="vc-emit vc-catch-emit">{issueString}</span>
          </span>
        </div>
      </div>

      {/* Hand-off */}
      <div className="vc-catch-flow" aria-hidden="true">
        <span className="vc-catch-flow-line" />
        <span className="vc-catch-flow-caret">↓</span>
        <span className="vc-catch-flow-line" />
      </div>

      {/* Stage 2 — read by the coding agent over MCP */}
      <div className="vc-catch-stage">
        <p className="vc-catch-label">
          To your coding agent <span className="vc-catch-label-sub">· MCP</span>
        </p>
        <div className="vc-catch-mcp">
          <div className="vc-catch-mcp-row" data-kind="cmd">
            <span className="vc-catch-mcp-pre">agent › </span>get_detected_issues
          </div>
          <div className="vc-catch-mcp-row" data-kind="out">
            <span className="vc-catch-mcp-pre">→ </span>
            {'{ detector: '}
            <span className="vc-catch-mcp-str">{`"${detector}"`}</span>
            {', issue: '}
            <span className="vc-catch-mcp-str vc-catch-mcp-issue">{`"${issueString}"`}</span>
            {', threshold: '}
            <span className="vc-catch-mcp-str">{`"${threshold}"`}</span>
            {' }'}
          </div>
        </div>
      </div>

      <p className="vc-catch-caption">
        The same string in your widget and in your agent&rsquo;s context — no screenshot, no
        copy-paste.
      </p>
    </div>
  )
}
