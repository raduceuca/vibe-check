// Circular audit score — a 0-100 pass rate with a letter grade, coloured by band
// (green/amber/red via the theme-tuned severity variables).
import { T } from '../../tokens.js'
import { TEXT_PX } from './typography.js'

export const gradeFor = (score: number): string =>
  score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'

// Pass rate over a detector's criteria, clamped to 0-100.
export const auditScore = (total: number, failed: number): number =>
  total > 0 ? Math.round((Math.max(0, total - Math.min(failed, total)) / total) * 100) : 100

export const scoreColor = (score: number): string =>
  score >= 80 ? 'var(--wcgw-sev-success)'
    : score >= 60 ? 'var(--wcgw-sev-warning)'
      : 'var(--wcgw-sev-critical)'

const colorFor = scoreColor

export const ScoreRing = ({ score, size = 60 }: { score: number; size?: number }) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score)))
  const sw = 4
  const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - clamped / 100)
  const mid = size / 2
  const color = colorFor(clamped)

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={mid} cy={mid} r={r} fill="none" stroke={T.border} strokeWidth={sw} />
        <circle
          cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: `stroke-dashoffset ${T.durationSlow} ${T.ease}, stroke ${T.durationNormal} ${T.ease}` }}
        />
      </svg>
      {/* Numeral + grade on one line, both at TEXT_PX — hierarchy is weight/colour,
          not a third size (2-size type rule). The arc carries the visual weight. */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', gap: 3, lineHeight: 1,
      }}>
        <span style={{ fontSize: TEXT_PX, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: T.text }}>
          {clamped}
        </span>
        <span style={{ fontSize: TEXT_PX, fontWeight: 600, color }}>
          {gradeFor(clamped)}
        </span>
      </div>
    </div>
  )
}
