import { useState } from 'react'
import type { SuggestionMode, DetectorName } from '@wcgw/vibe-check-core'
import { getSuggestion } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../store/issueStore.js'
import { T } from '../tokens.js'
import { Badge } from './ui/Badge.js'
import { CopyButton } from './ui/CopyButton.js'

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
    <div style={{ padding: '10px 10px', borderBottom: `1px solid ${T.borderSubtle}` }}>
      <div
        onClick={() => setExpanded((p) => !p)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded((p) => !p) } }}
        style={{ cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4, color: 'rgba(var(--vc-fg,255,255,255),0.85)' }}>
            {issue.title}
          </span>
          <span style={{ fontSize: 14, color: 'rgba(var(--vc-fg,255,255,255),0.15)', flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}>{'▼'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge severity={issue.severity} />
          {detail && (
            <span style={{ fontSize: 13, color: T.textTertiary, fontFamily: T.fontMono }}>{detail}</span>
          )}
        </div>
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

  return (
    <div style={{ paddingTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          fontSize: 14, fontWeight: 500, textTransform: 'uppercase',
          letterSpacing: '0.05em', color: 'rgba(var(--vc-fg,255,255,255),0.4)',
        }}>{mode === 'vibe' ? vibeHeading : heading}</span>
        {findings.length > 0 && (
          <span style={{
            fontSize: 14, fontWeight: 700, color: T.text,
            background: 'rgba(var(--vc-fg,255,255,255),0.08)', padding: '2px 7px', borderRadius: 6,
          }}>{findings.length}</span>
        )}
      </div>

      {findings.length === 0 ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '16px 12px',
          borderRadius: 8, background: T.bgSubtle, border: `1px solid ${T.borderSubtle}`,
        }}>
          <span data-vc-breathe style={{
            width: 8, height: 8, borderRadius: '50%', background: T.green,
            boxShadow: `0 0 6px ${T.green}50`, animation: 'vc-breathe 3s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>
            {mode === 'vibe' ? vibeEmptyLabel : emptyLabel}
          </span>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13.5, color: T.textTertiary, lineHeight: 1.5, margin: '0 0 10px' }}>
            {mode === 'vibe' ? vibeSubtitle : subtitle}
          </p>
          <div style={{ borderRadius: 8, background: 'rgba(var(--vc-fg,255,255,255),0.015)', border: `1px solid ${T.borderSubtle}`, overflow: 'hidden' }}>
            {findings.map((t) => (
              <AuditRow
                key={t.issue.id} tracked={t} mode={mode}
                copiedId={copiedId} onCopy={onCopy} onMarkSent={onMarkSent}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
