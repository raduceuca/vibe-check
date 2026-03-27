import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FrameRateCollector, computeStats } from '../frameRate.js'
import { EMPTY_FRAME_RATE_STATS } from '../../types.js'

// ── rAF mock ─────────────────────────────────────────────────────────────────

type RafCallback = (timestamp: number) => void

let rafCallbacks: Array<{ id: number; cb: RafCallback }> = []
let nextRafId = 1
let cancelledIds: Set<number> = new Set()

const originalRAF = globalThis.requestAnimationFrame
const originalCAF = globalThis.cancelAnimationFrame

const mockRequestAnimationFrame = (cb: RafCallback): number => {
  const id = nextRafId++
  rafCallbacks.push({ id, cb })
  return id
}

const mockCancelAnimationFrame = (id: number): void => {
  cancelledIds.add(id)
  rafCallbacks = rafCallbacks.filter((entry) => entry.id !== id)
}

/**
 * Flush one pending rAF callback with the given timestamp.
 * Each call simulates one animation frame.
 */
const flushOneFrame = (timestamp: number): void => {
  const entry = rafCallbacks.shift()
  if (entry && !cancelledIds.has(entry.id)) {
    entry.cb(timestamp)
  }
}

/**
 * Simulate a sequence of frames at constant intervals.
 * Returns the final timestamp.
 */
const simulateFrames = (
  count: number,
  intervalMs: number,
  startTime = 0
): number => {
  let t = startTime
  for (let i = 0; i < count; i++) {
    t += intervalMs
    flushOneFrame(t)
  }
  return t
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  rafCallbacks = []
  nextRafId = 1
  cancelledIds = new Set()
  globalThis.requestAnimationFrame = mockRequestAnimationFrame
  globalThis.cancelAnimationFrame = mockCancelAnimationFrame
})

afterEach(() => {
  globalThis.requestAnimationFrame = originalRAF
  globalThis.cancelAnimationFrame = originalCAF
  vi.restoreAllMocks()
})

// ── computeStats (pure function) ─────────────────────────────────────────────

describe('computeStats', () => {
  it('returns EMPTY stats for empty samples', () => {
    expect(computeStats([])).toEqual(EMPTY_FRAME_RATE_STATS)
  })

  it('computes FPS as sample count', () => {
    const samples = [
      { timestamp: 100, duration: 16 },
      { timestamp: 116, duration: 16 },
      { timestamp: 132, duration: 16 },
    ]
    const stats = computeStats(samples)
    expect(stats.fps).toBe(3)
  })

  it('computes average frame time', () => {
    const samples = [
      { timestamp: 100, duration: 10 },
      { timestamp: 110, duration: 20 },
    ]
    const stats = computeStats(samples)
    expect(stats.avgFrameTime).toBe(15)
  })

  it('tracks max frame time', () => {
    const samples = [
      { timestamp: 100, duration: 10 },
      { timestamp: 110, duration: 50 },
      { timestamp: 160, duration: 8 },
    ]
    const stats = computeStats(samples)
    expect(stats.maxFrameTime).toBe(50)
  })

  it('counts dropped frames (> 16.67ms)', () => {
    const samples = [
      { timestamp: 100, duration: 10 },
      { timestamp: 110, duration: 20 },
      { timestamp: 130, duration: 33 },
      { timestamp: 163, duration: 16 },
    ]
    const stats = computeStats(samples)
    expect(stats.droppedFrames).toBe(2) // 20ms and 33ms exceed 16.67ms
  })

  it('computes smoothness percentage', () => {
    // 2 out of 4 frames are on time (16 and 16), 2 dropped (20 and 33)
    const samples = [
      { timestamp: 100, duration: 16 },
      { timestamp: 116, duration: 20 },
      { timestamp: 136, duration: 33 },
      { timestamp: 169, duration: 16 },
    ]
    const stats = computeStats(samples)
    // (4 - 2) / 4 * 100 = 50%
    expect(stats.smoothness).toBe(50)
  })

  it('reports 100% smoothness when all frames are within budget', () => {
    const samples = [
      { timestamp: 100, duration: 15 },
      { timestamp: 115, duration: 16 },
      { timestamp: 131, duration: 14 },
    ]
    const stats = computeStats(samples)
    expect(stats.smoothness).toBe(100)
    expect(stats.droppedFrames).toBe(0)
  })
})

// ── FrameRateCollector ───────────────────────────────────────────────────────

describe('FrameRateCollector', () => {
  it('returns EMPTY stats before starting', () => {
    const collector = new FrameRateCollector()
    expect(collector.getStats()).toEqual(EMPTY_FRAME_RATE_STATS)
  })

  it('returns EMPTY stats after stopping', () => {
    const collector = new FrameRateCollector()
    collector.start()

    // Simulate a few frames
    flushOneFrame(100)
    flushOneFrame(116.67)
    flushOneFrame(133.34)

    collector.stop()
    expect(collector.getStats()).toEqual(EMPTY_FRAME_RATE_STATS)
  })

  it('schedules rAF on start', () => {
    const collector = new FrameRateCollector()
    collector.start()
    // There should be exactly one pending rAF callback
    expect(rafCallbacks).toHaveLength(1)
    collector.stop()
  })

  it('cancels rAF on stop', () => {
    const collector = new FrameRateCollector()
    collector.start()
    expect(rafCallbacks).toHaveLength(1)
    collector.stop()
    // After stop, the pending callback should have been cancelled
    expect(cancelledIds.size).toBeGreaterThan(0)
  })

  it('does not double-start', () => {
    const collector = new FrameRateCollector()
    collector.start()
    const pendingBefore = rafCallbacks.length
    collector.start() // second call is no-op
    expect(rafCallbacks).toHaveLength(pendingBefore)
    collector.stop()
  })

  it('fires callback on update with computed stats', () => {
    const collector = new FrameRateCollector()
    const callback = vi.fn()
    collector.onUpdate(callback)
    collector.start()

    // First frame: no duration recorded (no previous timestamp)
    flushOneFrame(0)

    // Simulate ~30 frames at 16.67ms each over ~500ms to trigger report
    let t = 0
    for (let i = 0; i < 30; i++) {
      t += 16.67
      flushOneFrame(t)
    }

    // Report fires at >=500ms. We need a frame past 500ms.
    t += 16.67
    flushOneFrame(t)

    expect(callback).toHaveBeenCalled()
    const stats = callback.mock.calls[0][0]
    expect(stats.fps).toBeGreaterThan(0)
    // 16.67ms > 1000/60 (16.666...) by a tiny margin, so frames may be counted as dropped
    expect(stats.smoothness).toBeGreaterThanOrEqual(0)

    collector.stop()
  })

  it('unsubscribes via returned disposer', () => {
    const collector = new FrameRateCollector()
    const callback = vi.fn()
    const unsub = collector.onUpdate(callback)
    unsub()

    collector.start()

    // Run enough frames to trigger report
    flushOneFrame(0)
    simulateFrames(35, 16.67, 0)

    expect(callback).not.toHaveBeenCalled()
    collector.stop()
  })

  it('detects dropped frames in stats', () => {
    const collector = new FrameRateCollector()
    const callback = vi.fn()
    collector.onUpdate(callback)
    collector.start()

    // First frame — establishes baseline
    flushOneFrame(0)

    // Mix of good frames and a long frame
    flushOneFrame(16.67) // 16.67ms — on budget
    flushOneFrame(33.34) // 16.67ms — on budget
    flushOneFrame(50.01) // 16.67ms — on budget
    flushOneFrame(120) // 69.99ms — DROPPED

    // More good frames to fill the window and pass 500ms
    let t = 120
    for (let i = 0; i < 25; i++) {
      t += 16.67
      flushOneFrame(t)
    }

    // Trigger report (past 500ms)
    t += 16.67
    flushOneFrame(t)

    expect(callback).toHaveBeenCalled()
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    expect(lastCall.droppedFrames).toBeGreaterThanOrEqual(1)
    expect(lastCall.maxFrameTime).toBeGreaterThanOrEqual(60)

    collector.stop()
  })

  it('trims samples outside the 1s rolling window', () => {
    const collector = new FrameRateCollector()
    const callback = vi.fn()
    collector.onUpdate(callback)
    collector.start()

    // Establish baseline at t=0
    flushOneFrame(0)

    // Generate frames for 2s (past the 1s window)
    let t = 0
    for (let i = 0; i < 120; i++) {
      t += 16.67
      flushOneFrame(t)
    }

    // At ~2s, only frames from the last 1s should remain
    // That's roughly 60 frames at 16.67ms
    expect(callback).toHaveBeenCalled()
    const lastCall = callback.mock.calls[callback.mock.calls.length - 1][0]
    // fps should be approximately 60 (the rolling 1s window count)
    expect(lastCall.fps).toBeGreaterThan(40)
    expect(lastCall.fps).toBeLessThanOrEqual(62)

    collector.stop()
  })

  it('cleans up state fully on stop', () => {
    const collector = new FrameRateCollector()
    collector.start()
    flushOneFrame(0)
    flushOneFrame(16.67)
    collector.stop()

    // After stop, stats should be empty
    expect(collector.getStats()).toEqual(EMPTY_FRAME_RATE_STATS)

    // Starting again should work cleanly
    collector.start()
    expect(collector.getStats()).toEqual(EMPTY_FRAME_RATE_STATS)
    collector.stop()
  })
})
