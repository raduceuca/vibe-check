import { memo } from 'react'
import type { SuggestionMode, DetectorName } from '@wcgw/vibe-check-core'
import { SEO_CRITERIA_COUNT, AEO_CRITERIA_COUNT } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { getSuggestionCached } from './suggestionCache.js'
import { ScoreRing } from './ui/ScoreRing.js'
import { CopyButton } from './ui/CopyButton.js'
import { Row } from './ui/Row.js'
import { EmptyState } from './ui/EmptyState.js'
import { sectionLabelStyle } from './ui/SectionHeader.js'

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
  const { issue } = tracked
  const suggestion = getSuggestionCached(issue, mode)
  const detail = typeof issue.evidence['detail'] === 'string' ? (issue.evidence['detail'] as string) : ''

  const handleCopy = async () => {
    const ok = await onCopy(suggestion.prompt, issue.id)
    if (ok && tracked.status === 'new') onMarkSent(issue.id)
  }

  return (
    <Row
      severity={issue.severity}
      title={issue.title}
    >
      <div style={{ fontSize: 14, color: T.textTertiary, lineHeight: 1.55, marginBottom: 10 }}>
        {suggestion.explanation}
      </div>
      {/* The evidence detail lives here (14px mono) instead of a truncating
          trailing meta — the row title already truncates, so an inline meta was
          a second ellipsis on one line. */}
      {detail && (
        <div style={{ fontSize: 14, color: T.textMuted, fontFamily: T.fontMono, lineHeight: 1.5, marginBottom: 10, wordBreak: 'break-word' }}>
          {detail}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <CopyButton
          copied={copiedId === issue.id}
          onClick={handleCopy}
          label={tracked.status === 'new' ? 'copy & send' : 'copy'}
        />
      </div>
    </Row>
  )
}

export const AuditPanel = memo(({
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
          <div style={sectionLabelStyle}>{mode === 'vibe' ? vibeHeading : heading}</div>
          <div style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500, marginTop: 4 }}>
            {passed} of {total} checks {passed === 1 ? 'passes' : 'pass'}
          </div>
          {failed > 0 && (
            <div style={{ fontSize: 14, color: T.textTertiary, marginTop: 2 }}>
              {failed} {mode === 'vibe' ? (failed === 1 ? 'thing to fix' : 'things to fix') : failed === 1 ? 'issue below' : 'issues below'}
            </div>
          )}
        </div>
      </div>

      {/* Plain-language description of what this audit checks */}
      <p style={{ fontSize: 14, color: T.textTertiary, lineHeight: 1.5, margin: '0 0 14px' }}>
        {mode === 'vibe' ? vibeSubtitle : subtitle}
      </p>

      {findings.length === 0 ? (
        <EmptyState label={mode === 'vibe' ? vibeEmptyLabel : emptyLabel} />
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
})
