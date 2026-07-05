import type { CSSProperties } from 'react'
import { T } from '../../tokens.js'

// The floating-surface chrome shared by the expanded panel and the on-page
// annotation popover: an opaque background + elevation ring. No backdrop blur —
// the surface sits at ~0.98 alpha, so blur was pure GPU cost with no visible
// effect (and depressed the very FPS number the widget reports). Callers layer
// their own radius/border on top.
export const surfaceStyle: CSSProperties = {
  background: T.bg,
  boxShadow: T.shadowLg,
}
