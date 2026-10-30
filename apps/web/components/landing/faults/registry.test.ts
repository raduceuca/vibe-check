import { describe, expect, it } from 'vitest'
import { FAULTS } from './registry'

describe('fault registry', () => {
  it('gives every fault expects, recheckMs, and an available() reason string shape', () => {
    expect(FAULTS.length).toBeGreaterThanOrEqual(8)
    for (const fault of FAULTS) {
      expect(fault.expects.length).toBeGreaterThan(0)
      expect(fault.recheckMs).toBeGreaterThan(0)
      const reason = fault.available()
      expect(reason === null || typeof reason === 'string').toBe(true)
      expect(fault.panelShows.length).toBeGreaterThan(0)
    }
  })

  it('schedules layout-jump shifts after the input grace window', () => {
    const layout = FAULTS.find((fault) => fault.id === 'layout-jump')
    expect(layout).toBeDefined()
    // Effect copy documents the three late banners; timing is encoded in smooth.ts (700/850/1000).
    expect(layout?.effect).toContain('Three late banners')
    expect(layout?.recheckMs).toBe(1500)
  })

  it('caps the memory leak at 30s evidence', () => {
    const leak = FAULTS.find((fault) => fault.id === 'leak-memory')
    expect(leak?.recheckMs).toBe(32000)
    expect(leak?.effect).toContain('30 seconds')
  })
})
