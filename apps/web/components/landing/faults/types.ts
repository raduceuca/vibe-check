import type { DetectorName } from '@wcgw/vibe-check-core'
import type { VibeId } from '@/lib/vibes'
import type { VibeEngine } from '@wcgw/vibe-check-core'

export type FaultId =
  | 'layout-jump'
  | 'freeze-main'
  | 'render-reviews'
  | 'camera-photo'
  | 'fetch-twice'
  | 'leak-memory'
  | 'flood-console'
  | 'placeholder-title'
  | 'hide-jsonld'

export interface FaultContext {
  readonly engine: VibeEngine | null
  readonly bannerSlot: HTMLElement | null
  readonly reviews: HTMLElement | null
  readonly photo: HTMLElement | null
  readonly setStatus: (message: string) => void
}

export interface Fault {
  readonly id: FaultId
  readonly vibe: VibeId
  readonly label: string
  readonly effect: string
  readonly panelShows: string
  readonly expects: readonly { readonly detector: DetectorName; readonly check?: string }[]
  readonly recheckMs: number
  readonly available: () => string | null
  readonly run: (ctx: FaultContext) => void
  readonly undo: (ctx: FaultContext) => void
}

export const afterNextPaint = (fn: () => void): void => {
  requestAnimationFrame(() => {
    window.setTimeout(fn, 0)
  })
}
