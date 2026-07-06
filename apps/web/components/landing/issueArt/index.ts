import type { ReactElement } from 'react'
import { DomBloatArt } from './DomBloatArt'
import { DuplicateRequestsArt } from './DuplicateRequestsArt'
import { ConsoleSpamArt } from './ConsoleSpamArt'
import { MemoryLeakArt } from './MemoryLeakArt'
import { LayoutThrashingArt } from './LayoutThrashingArt'
import { LongTaskAttributionArt } from './LongTaskAttributionArt'
import { UnoptimizedImagesArt } from './UnoptimizedImagesArt'
import { LargeImagesArt } from './LargeImagesArt'
import { ResourceBloatArt } from './ResourceBloatArt'
import { HeavyLibraryArt } from './HeavyLibraryArt'
import { WebEssentialsArt } from './WebEssentialsArt'
import { SeoArt } from './SeoArt'
import { AeoArt } from './AeoArt'

export { DomBloatArt } from './DomBloatArt'
export { DuplicateRequestsArt } from './DuplicateRequestsArt'
export { ConsoleSpamArt } from './ConsoleSpamArt'
export { MemoryLeakArt } from './MemoryLeakArt'
export { LayoutThrashingArt } from './LayoutThrashingArt'
export { LongTaskAttributionArt } from './LongTaskAttributionArt'
export { UnoptimizedImagesArt } from './UnoptimizedImagesArt'
export { LargeImagesArt } from './LargeImagesArt'
export { ResourceBloatArt } from './ResourceBloatArt'
export { HeavyLibraryArt } from './HeavyLibraryArt'
export { WebEssentialsArt } from './WebEssentialsArt'
export { SeoArt } from './SeoArt'
export { AeoArt } from './AeoArt'

// Maps a detector `name` (as used in DetectorsGrid) to its glyph, so the grid can
// resolve one illustration per card without a switch. Keys mirror the detector
// set exported from @wcgw/vibe-check-core.
export const ISSUE_ART: Readonly<Record<string, () => ReactElement>> = {
  'dom-bloat': DomBloatArt,
  'duplicate-requests': DuplicateRequestsArt,
  'console-spam': ConsoleSpamArt,
  'memory-leak': MemoryLeakArt,
  'layout-thrashing': LayoutThrashingArt,
  'long-task-attribution': LongTaskAttributionArt,
  'unoptimized-images': UnoptimizedImagesArt,
  'large-images': LargeImagesArt,
  'resource-bloat': ResourceBloatArt,
  'heavy-library': HeavyLibraryArt,
  'web-essentials': WebEssentialsArt,
  seo: SeoArt,
  aeo: AeoArt,
}
