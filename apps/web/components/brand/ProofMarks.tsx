interface ProofMarkProps {
  readonly className?: string
}

const PROCESS_INKS = ['c', 'm', 'y', 'k'] as const

export const ProofRail = ({ className }: ProofMarkProps) => (
  <span className={className} aria-hidden="true" style={{ display: 'inline-flex' }}>
    {PROCESS_INKS.map((ink) => (
      <i key={ink} style={{ background: `var(--vc-proof-${ink})` }} />
    ))}
  </span>
)

export const RegistrationConstellation = ({ className }: ProofMarkProps) => (
  <svg
    className={className}
    viewBox="0 0 96 96"
    aria-hidden="true"
    focusable="false"
    fill="none"
  >
    <g className="vc-registration-plate vc-registration-plate-c">
      <circle cx="48" cy="48" r="31" />
      <path d="M7 48h82M48 7v82" />
    </g>
    <g className="vc-registration-plate vc-registration-plate-m">
      <circle cx="48" cy="48" r="31" />
      <path d="M7 48h82M48 7v82" />
    </g>
    <g className="vc-registration-plate vc-registration-plate-k">
      <circle cx="48" cy="48" r="31" />
      <circle cx="48" cy="48" r="16" />
      <path d="M7 48h82M48 7v82" />
      <circle cx="48" cy="48" r="2.5" fill="currentColor" stroke="none" />
    </g>
  </svg>
)
