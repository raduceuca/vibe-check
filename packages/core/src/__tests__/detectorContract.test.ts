import { describe, it, expect } from 'vitest'
import { DETECTOR_NAMES } from '@wcgw/vibe-check-protocol'
import {
  createDomBloatDetector,
  createDuplicateRequestsDetector,
  createConsoleSpamDetector,
  createMemoryLeakDetector,
  createLayoutThrashingDetector,
  createUnoptimizedImagesDetector,
  createLongTaskAttributionDetector,
  createResourceBloatDetector,
  createLargeImagesDetector,
  createWebEssentialsDetector,
  createHeavyLibraryDetector,
  createSeoDetector,
  createAeoDetector,
} from '../index.js'

// Guards the contract between the detector implementations and the shared
// DetectorName enum: every detector's `name` must be a protocol member, and the
// protocol must list exactly the detectors that exist — no orphan enum members
// (which would have no suggestion) and no unregistered detectors.
describe('detector ↔ protocol contract', () => {
  const detectors = [
    createDomBloatDetector(),
    createDuplicateRequestsDetector(),
    createConsoleSpamDetector(),
    createMemoryLeakDetector(),
    createLayoutThrashingDetector(),
    createUnoptimizedImagesDetector(),
    createLongTaskAttributionDetector(),
    createResourceBloatDetector(),
    createLargeImagesDetector(),
    createWebEssentialsDetector(),
    createHeavyLibraryDetector(),
    createSeoDetector(),
    createAeoDetector(),
  ]

  it('every detector name is a protocol DetectorName, and the sets match exactly', () => {
    const detectorNames = detectors.map((d) => d.name).sort()
    expect(detectorNames).toEqual([...DETECTOR_NAMES].sort())
  })

  it('detector names are unique', () => {
    const names = detectors.map((d) => d.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
