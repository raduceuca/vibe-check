import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createScriptedEngine } from '../scriptedEngine.js'
import type { ScriptedScenario } from '../scriptedEngine.js'
import type { VibeIssue, VibeSnapshot } from '../types.js'
import { EMPTY_FRAME_RATE_STATS } from '../types.js'

const makeIssue = (id: string): VibeIssue => ({
  id,
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'Too many elements on the page',
  description: 'Scripted issue',
  evidence: { nodeCount: 5000, maxDepth: 20, timestamp: 0 },
  timestamp: 0,
  acknowledged: false,
  resolved: false,
})

const scenario: ScriptedScenario = {
  stepMs: 1000,
  frames: [
    { snapshot: { frameRate: { ...EMPTY_FRAME_RATE_STATS, fps: 60 } }, issues: [] },
    { afterMs: 1000, snapshot: { frameRate: { ...EMPTY_FRAME_RATE_STATS, fps: 18 } }, issues: [makeIssue('scripted-1')] },
  ],
}

describe('createScriptedEngine', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('implements the engine surface consumed by the widget', () => {
    const engine = createScriptedEngine(scenario)
    expect(typeof engine.start).toBe('function')
    expect(typeof engine.stop).toBe('function')
    expect(typeof engine.getSnapshot).toBe('function')
    expect(typeof engine.getIssues).toBe('function')
    expect(typeof engine.clearIssues).toBe('function')
    expect(typeof engine.onSnapshot).toBe('function')
    expect(typeof engine.isRunning).toBe('function')
    expect(typeof engine.getBeaconStatus).toBe('function')
  })

  it('fires onSnapshot with the scripted timeline in order', () => {
    const engine = createScriptedEngine(scenario)
    const received: VibeSnapshot[] = []
    const unsubscribe = engine.onSnapshot((s) => received.push(s))

    engine.start()
    // Frame 0 applies synchronously on start.
    expect(received).toHaveLength(1)
    expect(received[0]!.frameRate.fps).toBe(60)
    expect(received[0]!.issues).toHaveLength(0)
    expect(engine.isRunning()).toBe(true)

    vi.advanceTimersByTime(1000)
    expect(received).toHaveLength(2)
    expect(received[1]!.frameRate.fps).toBe(18)
    expect(received[1]!.issues).toHaveLength(1)
    expect(received[1]!.issues[0]!.id).toBe('scripted-1')

    // getSnapshot / getIssues reflect the latest scripted frame.
    expect(engine.getSnapshot().frameRate.fps).toBe(18)
    expect(engine.getIssues()).toHaveLength(1)

    unsubscribe()
    vi.advanceTimersByTime(2000)
    expect(received).toHaveLength(2) // no more after unsubscribe

    engine.stop()
    expect(engine.isRunning()).toBe(false)
  })

  it('stops cleanly — no frames fire after stop()', () => {
    const engine = createScriptedEngine(scenario)
    const received: VibeSnapshot[] = []
    engine.onSnapshot((s) => received.push(s))

    engine.start()
    expect(received).toHaveLength(1)
    engine.stop()
    vi.advanceTimersByTime(5000)
    expect(received).toHaveLength(1)
  })

  it('clearIssues empties the current issue list', () => {
    const engine = createScriptedEngine(scenario)
    engine.start()
    vi.advanceTimersByTime(1000)
    expect(engine.getIssues()).toHaveLength(1)
    engine.clearIssues()
    expect(engine.getIssues()).toHaveLength(0)
  })

  it('getBeaconStatus is null (scripted engine has no beacon)', () => {
    const engine = createScriptedEngine(scenario)
    expect(engine.getBeaconStatus()).toBeNull()
  })
})
