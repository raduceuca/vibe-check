// Circular audit score — a 0-100 pass rate with a letter grade, coloured by band
// (green/amber/red via the theme-tuned severity variables).

export const gradeFor = (score: number): string =>
  score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'

// Pass rate over a detector's criteria, clamped to 0-100.
export const auditScore = (total: number, failed: number): number =>
  total > 0 ? Math.round((Math.max(0, total - Math.min(failed, total)) / total) * 100) : 100

export const scoreColor = (score: number): string =>
  score >= 80 ? 'var(--vc-sev-success, #4ade80)'
    : score >= 60 ? 'var(--vc-sev-warning, #facc15)'
      : 'var(--vc-sev-critical, #f87171)'

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
        <circle cx={mid} cy={mid} r={r} fill="none" stroke="rgba(var(--vc-fg,255,255,255),0.08)" strokeWidth={sw} />
        <circle
          cx={mid} cy={mid} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4,0,0.2,1), stroke 0.3s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', lineHeight: 1,
      }}>
        <span style={{ fontSize: Math.round(size * 0.32), fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em', color: 'rgba(var(--vc-fg,255,255,255),0.95)' }}>
          {clamped}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color, marginTop: 2 }}>
          {gradeFor(clamped)}
        </span>
      </div>
    </div>
  )
}
