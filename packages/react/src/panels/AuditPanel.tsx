import { useState } from 'react'
import type { SuggestionMode, DetectorName } from '@wcgw/vibe-check-core'
import { getSuggestion, SEO_CRITERIA_COUNT, AEO_CRITERIA_COUNT } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { SeverityDot } from './ui/Badge.js'
import { Chevron } from './ui/Chevron.js'
import { ScoreRing } from './ui/ScoreRing.js'
import { CopyButton } from './ui/CopyButton.js'

// Total criteria each audit detector evaluates — the denominator for the score.
const CRITERIA_TOTAL: Partial<Record<DetectorName, number>> = {
  seo: SEO_CRITERIA_COUNT,
  aeo: AEO_CRITERIA_COUNT,
}

// Shared panel for the audit tabs (SEO, AEO) — lists the findings from one
// detector, each row expandable with a copy-to-AI fix prompt.
interface AuditPanelProps {
  readonly tracked: readonly TrackedIssue[]
  readonly detector: DetectorName
  readonly heading: string
  readonly vibeHeading: string
  readonly subtitle: string
  readonly vibeSubtitle: string
  readonly emptyLabel: string
  readonly vibeEmptyLabel: string
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onMarkSent: (issueId: string) => void
}

const AuditRow = ({
  tracked, mode, copiedId, onCopy, onMarkSent,
}: {
  readonly tracked: TrackedIssue
  readonly mode: SuggestionMode
  readonly copiedId: string | null
  readonly onCopy: (text: string, id: string) => Promise<boolean>
  readonly onMarkSent: (issueId: string) => void
}) => {
  const [expanded, setExpanded] = useState(false)
  const { issue } = tracked
  const suggestion = getSuggestion(issue, mode)
  const detail = typeof issue.evidence['detail'] === 'string' ? (issue.evidence['detail'] as string) : ''

  const handleCopy = async () => {
    const ok = await onCopy(suggestion.prompt, issue.id)
    if (ok && tracked.status === 'new') onMarkSent(issue.id)
  }

  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid rgba(var(--vc-fg,255,255,255),0.06)' }}>
      <div
        onClick={() => setExpanded((p) => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((p) => !p) } }}
        aria-expanded={expanded}
        style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', minHeight: 20 }}
      >
        <SeverityDot severity={issue.severity} />
        <span style={{
          flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, lineHeight: 1.4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'rgba(var(--vc-fg,255,255,255),0.95)',
        }}>
          {issue.title}
        </span>
        {detail && (
          <span style={{ fontSize: 12, color: T.textTertiary, fontFamily: T.fontMono, flexShrink: 0, maxWidth: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
        )}
        <Chevron open={expanded} />
      </div>

      {expanded && (
        <div style={{ marginTop: 10, animation: 'vc-fade-in 0.15s ease' }}>
          <div style={{ fontSize: 14, color: 'rgba(var(--vc-fg,255,255,255),0.55)', lineHeight: 1.55, marginBottom: 10 }}>
            {suggestion.explanation}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <CopyButton
              copied={copiedId === issue.id}
              onClick={handleCopy}
              label={tracked.status === 'new' ? 'copy & send' : 'copy'}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export const AuditPanel = ({
  tracked, detector, heading, vibeHeading, subtitle, vibeSubtitle,
  emptyLabel, vibeEmptyLabel, mode, copiedId, onCopy, onMarkSent,
}: AuditPanelProps) => {
  const findings = tracked.filter((t) => t.issue.detector === detector && t.status !== 'resolved')

  // Score the audit as a pass rate over the detector's criteria. Resolving an
  // issue removes it from `findings`, so the score climbs as you fix things.
  const total = CRITERIA_TOTAL[detector] ?? Math.max(findings.length, 1)
  const failed = Math.min(findings.length, total)
  const passed = total - failed
  const score = Math.round((passed / total) * 100)

  return (
    <div style={{ paddingTop: 4 }}>
      {/* Score header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <ScoreRing score={score} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 500, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: 'rgba(var(--vc-fg,255,255,255),0.5)',
          }}>{mode === 'vibe' ? vibeHeading : heading}</div>
          <div style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500, marginTop: 4 }}>
            {passed} of {total} checks pass
          </div>
          {failed > 0 && (
            <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 2 }}>
              {failed} {mode === 'vibe' ? (failed === 1 ? 'thing to fix' : 'things to fix') : failed === 1 ? 'issue below' : 'issues below'}
            </div>
          )}
        </div>
      </div>

      {/* Plain-language description of what this audit checks */}
      <p style={{ fontSize: 13.5, color: T.textTertiary, lineHeight: 1.5, margin: '0 0 14px' }}>
        {mode === 'vibe' ? vibeSubtitle : subtitle}
      </p>

      {findings.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
          <span data-vc-breathe style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--vc-sev-success, #4ade80)',
            animation: 'vc-breathe 3s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>
            {mode === 'vibe' ? vibeEmptyLabel : emptyLabel}
          </span>
        </div>
      ) : (
        <div>
          {findings.map((t) => (
            <AuditRow
              key={t.issue.id} tracked={t} mode={mode}
              copiedId={copiedId} onCopy={onCopy} onMarkSent={onMarkSent}
            />
          ))}
        </div>
      )}
    </div>
  )
}
