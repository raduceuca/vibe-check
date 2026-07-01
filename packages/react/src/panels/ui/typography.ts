import type { CSSProperties } from 'react'
import { T } from '../../tokens.js'

// ── Type scale (Quiet Instrument) ────────────────────────────────────────────
// TWO sizes only: DISPLAY (the one hero number) and TEXT (14px — everything
// else). Hierarchy comes from weight, case, and the text-colour ladder, never
// from more sizes. Codified so styles can't drift back into a dozen ad-hoc px.
export const DISPLAY_PX = 34
export const TEXT_PX = 14
export const T_VALUE: CSSProperties = { fontSize: TEXT_PX, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: T.text }
export const T_LABEL: CSSProperties = { fontSize: TEXT_PX, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em', color: T.textTertiary }
export const T_UNIT: CSSProperties = { fontSize: TEXT_PX, fontWeight: 500, color: T.textTertiary }

export const KICKER: CSSProperties = { ...T_LABEL }
export const SUBKICKER: CSSProperties = { ...T_LABEL, marginBottom: 6 }
export const STAT_LABEL: CSSProperties = { ...T_LABEL, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
export const STAT_VALUE: CSSProperties = { ...T_VALUE, display: 'flex', alignItems: 'center', gap: 4, minHeight: 18 }
export const STAT_GRID: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, alignItems: 'start' }
// Hairline that separates the panel's major blocks without a hard border.
export const DIVIDER: CSSProperties = { borderTop: `1px solid ${T.border}`, paddingTop: 14, marginTop: 4 }
// Finer, tighter separation for related sub-groups (e.g. FPS -> its metrics).
export const FINE: CSSProperties = { borderTop: `1px solid ${T.borderSubtle}`, paddingTop: 11, marginTop: 11 }

export const QUIET_LINK: CSSProperties = {
  fontSize: 14, fontWeight: 500, color: T.textSecondary,
  background: 'transparent', border: 'none', cursor: 'pointer',
  fontFamily: 'inherit', outline: 'none', padding: '4px 2px', minHeight: 30,
  transition: 'color 0.2s ease, scale 0.12s ease',
}
