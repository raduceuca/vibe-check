import type { ReactNode } from 'react'

interface ProofMarkProps {
  readonly className?: string
}

interface ProofRailProps extends ProofMarkProps {
  readonly label: string
  readonly weight?: 'hero' | 'section' | 'compact'
}

interface ProofControlStripProps extends ProofMarkProps {
  readonly weight?: 'hero' | 'section' | 'compact'
}

interface StructuralRuleMarkProps extends ProofMarkProps {
  readonly orientation?: 'horizontal' | 'vertical'
  readonly color?: boolean
}

const CONTROL_PATCHES = [
  { ink: 'c', width: 7 },
  { ink: 'm', width: 10 },
  { ink: 'y', width: 5 },
  { ink: 'k', width: 12 },
  { ink: 'c', width: 7 },
  { ink: 'm', width: 4 },
  { ink: 'y', width: 6 },
  { ink: 'k', width: 9 },
] as const

interface CropTicksProps extends ProofMarkProps {
  readonly corner?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

interface CalibrationRulerProps extends ProofMarkProps {
  readonly orientation?: 'horizontal' | 'vertical'
}

interface ProofLabelProps extends ProofMarkProps {
  readonly children: ReactNode
}

export const ProofControlStrip = ({
  className,
  weight = 'hero',
}: ProofControlStripProps) => (
  <span
    className={className}
    aria-hidden="true"
    data-vc-proof-control-strip=""
    data-vc-proof-weight={weight}
    style={{ display: 'inline-flex' }}
  >
    {CONTROL_PATCHES.map(({ ink, width }, index) => (
      <i
        key={`${ink}-${index}`}
        data-vc-proof-patch=""
        data-width={width}
        style={{ background: `var(--vc-proof-${ink})`, width }}
      />
    ))}
  </span>
)

export const ProofRail = ({
  className,
  label,
  weight = 'section',
}: ProofRailProps) => (
  <span className={className} data-vc-proof-rail={weight} aria-hidden="true">
    <CropTicks />
    <ProofControlStrip weight={weight} />
    <ProofLabel>{label}</ProofLabel>
    <span data-vc-proof-rule="" />
    <RegistrationTarget />
  </span>
)

export const StructuralRuleMark = ({
  className,
  orientation = 'horizontal',
  color = false,
}: StructuralRuleMarkProps) => (
  <span
    className={className}
    data-vc-structural-rule={orientation}
    data-vc-rule-color={color ? 'true' : undefined}
    aria-hidden="true"
  >
    <i />
    <i />
    {color ? <ProofControlStrip weight="compact" /> : null}
  </span>
)

export const CropTicks = ({ className, corner = 'top-left' }: CropTicksProps) => (
  <span
    className={className}
    aria-hidden="true"
    data-vc-crop-ticks={corner}
  >
    <i />
    <i />
  </span>
)

export const ProofLabel = ({ className, children }: ProofLabelProps) => (
  <span className={className} data-vc-proof-label="">
    {children}
  </span>
)

export const CalibrationRuler = ({
  className,
  orientation = 'horizontal',
}: CalibrationRulerProps) => (
  <span
    className={className}
    aria-hidden="true"
    data-vc-calibration-ruler={orientation}
  />
)

export const RegistrationTarget = ({ className }: ProofMarkProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    fill="none"
    data-vc-registration-target=""
  >
    <circle cx="12" cy="12" r="6.5" />
    <circle cx="12" cy="12" r="2.25" />
    <path d="M1 12h22M12 1v22" />
  </svg>
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
