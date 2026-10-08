import { T } from '../../tokens.js'

/** Quiet hairline between monitor sections. */
export const SectionDivider = ({
  kind = 'major',
}: {
  readonly kind?: 'major' | 'minor'
}) => (
  <span
    data-testid="vibe-check-divider"
    data-kind={kind}
    aria-hidden="true"
    style={{
      display: 'block',
      width: '100%',
      height: 1,
      background: kind === 'major' ? T.border : T.borderSubtle,
      pointerEvents: 'none',
    }}
  />
)
