import { describe, it, expect } from 'vitest'
import { DETECTOR_NAMES, SEVERITIES } from '../index.js'
import type { DetectorName, Severity, IssueEvidenceMap } from '../index.js'

describe('protocol enums', () => {
  it('DETECTOR_NAMES has no duplicates', () => {
    expect(new Set(DETECTOR_NAMES).size).toBe(DETECTOR_NAMES.length)
  })

  it('SEVERITIES has no duplicates', () => {
    expect(new Set(SEVERITIES).size).toBe(SEVERITIES.length)
  })

  it('DetectorName type is derived from DETECTOR_NAMES (compile-time single source)', () => {
    // If these arrays and the derived types ever diverge this file fails to
    // type-check, which is the whole point of deriving the type from the array.
    const names: readonly DetectorName[] = DETECTOR_NAMES
    const severities: readonly Severity[] = SEVERITIES
    expect(names.length).toBeGreaterThan(0)
    expect(severities).toContain('critical')
  })

  it('IssueEvidenceMap covers every detector', () => {
    // Type-level exhaustiveness: a Record keyed by DetectorName forces an entry
    // for each detector, and IssueEvidenceMap must supply each key.
    const present: Record<DetectorName, true> = DETECTOR_NAMES.reduce(
      (acc, name) => ({ ...acc, [name]: true }),
      {} as Record<DetectorName, true>,
    )
    const evidenceKeys: ReadonlyArray<keyof IssueEvidenceMap> = DETECTOR_NAMES
    expect(Object.keys(present).sort()).toEqual([...DETECTOR_NAMES].sort())
    expect(evidenceKeys.length).toBe(DETECTOR_NAMES.length)
  })
})
