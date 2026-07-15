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
export const SECTION_GAP: CSSProperties = { paddingTop: 14, marginTop: 4 }
export const SUBSECTION_GAP: CSSProperties = { paddingTop: 11, marginTop: 11 }
