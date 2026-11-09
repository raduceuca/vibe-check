import type { Fault, FaultId } from './types'
import { layoutJumpFault, freezeMainFault } from './smooth'
import {
  renderReviewsFault,
  cameraPhotoFault,
  fetchTwiceFault,
  leakMemoryFault,
} from './light'
import { floodConsoleFault } from './clean'
import { placeholderTitleFault } from './findable'
import { hideJsonLdFault } from './quotable'
import type { VibeId } from '@/lib/vibes'

export const FAULTS: readonly Fault[] = [
  layoutJumpFault,
  freezeMainFault,
  renderReviewsFault,
  cameraPhotoFault,
  fetchTwiceFault,
  leakMemoryFault,
  floodConsoleFault,
  placeholderTitleFault,
  hideJsonLdFault,
] as const

export const faultsForVibe = (vibe: VibeId): readonly Fault[] =>
  FAULTS.filter((fault) => fault.vibe === vibe)

export const getFault = (id: FaultId): Fault | undefined =>
  FAULTS.find((fault) => fault.id === id)

export const VIBE_ORDER: readonly VibeId[] = [
  'smooth',
  'light',
  'clean',
  'findable',
  'quotable',
] as const

export const VIBE_HEADING: Record<VibeId, string> = {
  smooth: 'Smooth',
  light: 'Light',
  clean: 'Clean',
  findable: 'Findable',
  quotable: 'Quotable',
}
