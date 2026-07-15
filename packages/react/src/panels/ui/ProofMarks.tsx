import { memo, type ReactNode } from 'react'
import { T } from '../../tokens.js'

interface FaultedProps {
  readonly faulted?: boolean
}

interface ProofControlStripProps {
  readonly compact?: boolean
}

interface RegistrationTargetProps extends FaultedProps {
  readonly size?: number
}

interface CropTicksProps {
  readonly corner?: 'top-left' | 'top-right'
  readonly size?: number
}

interface CalibrationRulerProps {
  readonly orientation?: 'horizontal' | 'vertical'
}

const PATCHES = [
  { ink: 'c', color: T.proofC, width: 7, opacity: 1 },
  { ink: 'm', color: T.proofM, width: 10, opacity: 1 },
  { ink: 'y', color: T.proofY, width: 5, opacity: 1 },
  { ink: 'k', color: T.proofK, width: 12, opacity: 1 },
  { ink: 'c', color: T.proofC, width: 7, opacity: 0.42 },
  { ink: 'm', color: T.proofM, width: 4, opacity: 0.42 },
  { ink: 'y', color: T.proofY, width: 6, opacity: 0.42 },
  { ink: 'k', color: T.proofK, width: 9, opacity: 0.24 },
] as const

export const ProofControlStrip = memo(({ compact = false }: ProofControlStripProps) => (
  <span
    data-wcgw-proof-control
    data-wcgw-proof-weight={compact ? 'compact' : 'standard'}
    aria-hidden="true"
    style={{ display: 'inline-flex', alignItems: 'center', gap: compact ? 0.75 : 1, height: compact ? 4 : 5, flexShrink: 0, pointerEvents: 'none' }}
  >
    {PATCHES.map((patch, index) => (
      <span
        key={`${patch.ink}-${index}`}
        data-wcgw-proof-patch
        data-wcgw-proof-ink={patch.ink}
        data-width={patch.width}
        style={{ width: compact ? Math.max(2, Math.round(patch.width * 0.62)) : patch.width, height: '100%', background: patch.color, opacity: patch.opacity, display: 'block', flexShrink: 0 }}
      />
    ))}
  </span>
))

export const RegistrationTarget = memo(({ faulted = false, size = 14 }: RegistrationTargetProps) => (
  <svg
    data-wcgw-registration-target
    data-wcgw-proof-control
    data-faulted={faulted ? 'true' : undefined}
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 16 16"
    width={size}
    height={size}
    fill="none"
    style={{ display: 'block', flexShrink: 0, overflow: 'visible', pointerEvents: 'none' }}
  >
    <g data-wcgw-proof-ink="c" stroke={T.proofC} strokeWidth={0.65} opacity={0.55}>
      <circle cx="8" cy="8" r="4.5" /><path d="M1 8h14M8 1v14" />
    </g>
    <g data-wcgw-proof-ink="m" stroke={T.proofM} strokeWidth={0.65} opacity={0.48}>
      <circle cx="8" cy="8" r="4.5" /><path d="M1 8h14M8 1v14" />
    </g>
    <g data-wcgw-proof-ink="k" stroke={T.proofK} strokeWidth={0.8} opacity={0.76}>
      <circle cx="8" cy="8" r="4.5" /><circle cx="8" cy="8" r="1.5" /><path d="M1 8h14M8 1v14" />
    </g>
  </svg>
))

export const CropTicks = memo(({ corner = 'top-left', size = 12 }: CropTicksProps) => {
  const path = corner === 'top-left' ? 'M1 7V1h6' : 'M5 1h6v6'
  return (
    <svg data-wcgw-crop-ticks aria-hidden="true" focusable="false" viewBox="0 0 12 12" width={size} height={size} style={{ display: 'block', flexShrink: 0, pointerEvents: 'none' }}>
      <path d={path} fill="none" stroke={T.textMuted} strokeWidth={0.75} />
    </svg>
  )
})

export const ProofDivider = memo(({ kind = 'major' }: { readonly kind?: 'major' | 'minor' }) => (
  <span
    data-wcgw-proof-divider={kind}
    aria-hidden="true"
    style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', height: 8, pointerEvents: 'none' }}
  >
    <CropTicks size={8} />
    {kind === 'major' ? <ProofControlStrip compact /> : null}
    <span style={{ height: 1, flex: 1, minWidth: 8, background: kind === 'major' ? T.border : T.borderSubtle }} />
  </span>
))

export const ProofLabel = ({ children }: { readonly children: ReactNode }) => (
  <span aria-hidden="true" style={{ fontFamily: T.fontMono, fontSize: 8, lineHeight: 1, letterSpacing: '0.12em', color: T.textMuted, whiteSpace: 'nowrap', flexShrink: 0 }}>
    {children}
  </span>
)

export const CalibrationRuler = memo(({ orientation = 'vertical' }: CalibrationRulerProps) => {
  const vertical = orientation === 'vertical'
  return (
    <svg
      data-wcgw-calibration-ruler
      aria-hidden="true"
      focusable="false"
      viewBox={vertical ? '0 0 8 48' : '0 0 48 8'}
      width={vertical ? 8 : 48}
      height={vertical ? 48 : 8}
      style={{ display: 'block', pointerEvents: 'none' }}
    >
      {Array.from({ length: 9 }, (_, index) => {
        const offset = 4 + index * 5
        const length = index % 4 === 0 ? 6 : index % 2 === 0 ? 4 : 2.5
        return vertical
          ? <path key={offset} d={`M${8 - length} ${offset}H8`} stroke={T.textMuted} strokeWidth={0.65} />
          : <path key={offset} d={`M${offset} ${8 - length}V8`} stroke={T.textMuted} strokeWidth={0.65} />
      })}
    </svg>
  )
})

export const TopProofRegister = memo(({ faulted = false }: FaultedProps) => (
  <span
    data-testid="wcgw-top-proof-register"
    data-wcgw-top-proof-register
    data-faulted={faulted ? 'true' : undefined}
    aria-hidden="true"
    style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', height: 16, padding: '7px 14px 0', boxSizing: 'border-box', pointerEvents: 'none' }}
  >
    <CropTicks size={11} />
    <ProofControlStrip />
    <ProofLabel>LIVE PROOF</ProofLabel>
    <span style={{ height: 1, background: T.borderSubtle, flex: 1, minWidth: 8 }} />
    <RegistrationTarget faulted={faulted} size={14} />
  </span>
))

export const PillProofRegister = memo(({ faulted = false }: FaultedProps) => (
  <span
    data-testid="wcgw-pill-proof-register"
    data-wcgw-pill-proof-register
    data-faulted={faulted ? 'true' : undefined}
    aria-hidden="true"
    style={{ display: 'inline-flex', alignItems: 'center', gap: 3, height: 8, pointerEvents: 'none' }}
  >
    <CropTicks size={8} />
    <ProofControlStrip compact />
    <RegistrationTarget faulted={faulted} size={8} />
  </span>
))
