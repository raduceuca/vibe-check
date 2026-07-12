import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VibeCheckEngine } from '../engine.js'

// Regression coverage for the high-severity console-teardown bug: the engine
// starts the ConsoleCollector (always) and the console-spam detector (default),
// both of which monkey-patch console.*. If stop() unwinds them in the wrong
// order (or restores blindly), the host's console.* is left wrapped by a dead
// collector, and PerfToggle-style enable/disable cycling stacks wrappers.
describe('VibeCheckEngine — console teardown', () => {
  let origLog: typeof console.log
  let origWarn: typeof console.warn
  let origError: typeof console.error

  // Keep only the two console patchers in play to isolate the behavior.
  const config = {
    detectors: {
      domBloat: false,
      duplicateRequests: false,
      consoleSpam: true,
      memoryLeak: false,
      layoutThrashing: false,
      unoptimizedImages: false,
      longTaskAttribution: false,
      resourceBloat: false,
      largeImages: false,
      webEssentials: false,
      heavyLibrary: false,
    },
  }

  beforeEach(() => {
    origLog = console.log
    origWarn = console.warn
    origError = console.error
  })

  afterEach(() => {
    console.log = origLog
    console.warn = origWarn
    console.error = origError
  })

  it('restores the host console after a single start/stop', () => {
    const engine = new VibeCheckEngine(config)
    engine.start()
    expect(console.log).not.toBe(origLog) // patched while running

    engine.stop()
    expect(console.log).toBe(origLog)
    expect(console.warn).toBe(origWarn)
    expect(console.error).toBe(origError)
  })

  it('does not stack console wrappers across repeated start/stop cycles', () => {
    for (let i = 0; i < 5; i++) {
      const engine = new VibeCheckEngine(config)
      engine.start()
      engine.stop()
    }
    expect(console.log).toBe(origLog)
    expect(console.warn).toBe(origWarn)
    expect(console.error).toBe(origError)
  })
})
