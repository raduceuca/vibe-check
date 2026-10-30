import type { CSSProperties } from 'react'
import type {
  IssuePhase,
  IssueWorkflowEvent,
  SuggestionMode,
  TrackedProjectIssue,
} from '@wcgw/vibe-check-core'
import { T } from '../tokens.js'

// 'sent' means the hub accepted the issue and no agent has confirmed receipt
// yet, so it reads "queued", never "sent". 'working' starts at that receipt.
const PHASE_LABELS: Readonly<Record<IssuePhase, string>> = {
  detected: 'Detected',
  sent: 'Queued for agent',
  working: 'With agent',
  verifying: 'Verifying',
  fixed: 'Fixed',
  regressed: 'Regressed',
}

const VIBE_PHASE_LABELS: Readonly<Record<IssuePhase, string>> = {
  detected: 'To fix',
  sent: 'Waiting for your AI to pick it up',
  working: 'With your AI',
  verifying: 'Checking the fix',
  fixed: 'Fixed',
  regressed: 'Came back',
}

const EVENT_LABELS: Readonly<Record<IssueWorkflowEvent['type'], string>> = {
  detected: 'Detected',
  sent: 'Queued for agent',
  working: 'With agent',
  'verification-requested': 'Check requested',
  'verification-failed': 'Still detected',
  fixed: 'Fixed',
  regressed: 'Regressed',
  'dispatch-dropped': 'Send dropped: no agent received it',
}

const phaseColor = (phase: IssuePhase): string => {
  if (phase === 'fixed') return T.green
  if (phase === 'regressed') return T.red
  if (phase === 'working' || phase === 'verifying') return T.green
  if (phase === 'sent') return T.blue
  return T.yellow
}

const badgeStyle = (phase: IssuePhase): CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 24,
  padding: '2px 8px',
  borderRadius: T.radiusPill,
  border: `1px solid color-mix(in srgb, ${phaseColor(phase)} 45%, transparent)`,
  color: phaseColor(phase),
  background: `color-mix(in srgb, ${phaseColor(phase)} 10%, transparent)`,
  fontSize: 14,
  fontWeight: 650,
})

interface IssueProgressProps {
  readonly tracked: TrackedProjectIssue
  readonly mode: SuggestionMode
}

export const IssueProgress = ({ tracked, mode }: IssueProgressProps) => {
  const labels = mode === 'vibe' ? VIBE_PHASE_LABELS : PHASE_LABELS
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
        <span style={badgeStyle(tracked.phase)}>{labels[tracked.phase]}</span>
        {tracked.occurrenceCount > 1 && (
          <span style={{ color: T.textTertiary, fontSize: 14 }}>
            Occurrence {tracked.occurrenceCount}
          </span>
        )}
        {tracked.regressionCount > 0 && (
          <span style={{ color: T.red, fontSize: 14 }}>
            Regressed {tracked.regressionCount} {tracked.regressionCount === 1 ? 'time' : 'times'}
          </span>
        )}
      </div>
      <ol aria-label="Issue progress" style={{
        listStyle: 'none',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        padding: 0,
        margin: '8px 0 0',
      }}>
        {tracked.events.map((event, index) => (
          <li key={`${event.type}-${event.at}-${index}`} style={{
            display: 'flex', alignItems: 'center', gap: 5, color: T.textMuted, fontSize: 14,
          }}>
            {index > 0 && <span aria-hidden="true">→</span>}
            <span>{EVENT_LABELS[event.type]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
