import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FrameRateCollector, computeStats, estimateFrameInterval } from '../frameRate.js'
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

  it('counts a frame as dropped only when it missed at least one refresh (> 1.5x the display interval)', () => {
    const samples = [
      { timestamp: 100, duration: 16.7 },
      { timestamp: 117, duration: 16.6 },
      { timestamp: 150, duration: 33.4 }, // one missed vsync
      { timestamp: 167, duration: 16.7 },
      { timestamp: 184, duration: 20 }, // late, but inside the same refresh
      { timestamp: 234, duration: 50 }, // two missed vsyncs
    ]
    const stats = computeStats(samples)
    expect(stats.droppedFrames).toBe(2)
  })

  it('computes smoothness percentage', () => {
    // 60 Hz page: 2 of 4 frames missed a refresh.
    const samples = [
      { timestamp: 100, duration: 16.7 },
      { timestamp: 133, duration: 33.4 },
      { timestamp: 183, duration: 50 },
      { timestamp: 200, duration: 16.7 },
    ]
    // (4 - 2) / 4 * 100 = 50%
    expect(computeStats(samples, 16.7).smoothness).toBe(50)
  })

  it('measures against a given display interval when one is passed', () => {
    const samples = Array.from({ length: 10 }, (_, i) => ({ timestamp: i * 33.4, duration: 33.4 }))
    expect(computeStats(samples, 16.7).droppedFrames).toBe(10)
    expect(computeStats(samples).droppedFrames).toBe(0)
  })

  // C10: rAF timestamps are coarsened (Chrome 0.1 ms, Firefox 1 ms), so an
  // on-time 60 Hz frame measures 16.6-16.8 ms. None of them is a dropped frame.
  it.each([0.1, 1, 0.005])('reports an idle 60 Hz page as smooth at %f ms timer resolution', (resolutionMs) => {
    const samples: Array<{ timestamp: number; duration: number }> = []
    let previous = 0
    for (let i = 1; i <= 60; i++) {
      const t = Math.round((1000 + i * (1000 / 60)) / resolutionMs) * resolutionMs
      if (i > 1) samples.push({ timestamp: t, duration: +(t - previous).toFixed(4) })
      previous = t
    }
    const stats = computeStats(samples)
    expect(stats.droppedFrames).toBe(0)
    expect(stats.smoothness).toBe(100)
  })

  it.each([
    ['30 Hz (iOS Low Power Mode)', 1000 / 30],
    ['50 Hz', 20],
    ['120 Hz', 1000 / 120],
    ['144 Hz', 1000 / 144],
  ])('reports a steady %s page as smooth', (_label, interval) => {
    const samples = Array.from({ length: 30 }, (_, i) => ({ timestamp: i * interval, duration: interval }))
    expect(computeStats(samples).smoothness).toBe(100)
  })

  it('estimates the display interval as the median frame delta', () => {
    expect(estimateFrameInterval([])).toBe(0)
    expect(estimateFrameInterval([16.7, 16.6, 50, 16.8, 16.7])).toBe(16.7)
    expect(estimateFrameInterval([8.3, 8.4])).toBeCloseTo(8.35)
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
    // On-time frames are measured against the display interval, not a fixed 16.67 ms budget.
    expect(stats.smoothness).toBe(100)

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

  it('keeps measuring a burst of jank against the display rate seen just before it', () => {
    const collector = new FrameRateCollector()
    collector.start()
    flushOneFrame(1000)

    // 2 s of smooth 60 Hz, then 1 s where every frame misses a refresh.
    let t = simulateFrames(120, 16.7, 1000)
    t = simulateFrames(30, 33.4, t)

    const stats = collector.getStats()
    expect(stats.fps).toBeLessThanOrEqual(31)
    expect(stats.droppedFrames).toBeGreaterThanOrEqual(25)
    expect(stats.smoothness).toBeLessThan(20)
    collector.stop()
  })

  // C22: rAF pauses in a background tab. The gap is not a frame.
  it('does not record a background-tab pause as a 30 s frame', () => {
    const collector = new FrameRateCollector()
    collector.start()
    flushOneFrame(1000)
    let t = simulateFrames(120, 16.7, 1000)
    t += 30_000
    flushOneFrame(t)
    simulateFrames(31, 16.7, t)

    const stats = collector.getStats()
    expect(stats.maxFrameTime).toBeLessThan(20)
    expect(stats.droppedFrames).toBe(0)
    collector.stop()
  })

  it('starts measuring afresh after a visibility change', () => {
    const collector = new FrameRateCollector()
    collector.start()
    flushOneFrame(1000)
    let t = simulateFrames(60, 16.7, 1000)
    document.dispatchEvent(new Event('visibilitychange'))
    // A 600 ms gap would be a (long) frame; after a visibility change it is not.
    t += 600
    flushOneFrame(t)
    simulateFrames(40, 16.7, t)

    expect(collector.getStats().maxFrameTime).toBeLessThan(20)
    collector.stop()
  })

  it('stops listening for visibility changes on stop', () => {
    const remove = vi.spyOn(document, 'removeEventListener')
    const collector = new FrameRateCollector()
    collector.start()
    collector.stop()
    expect(remove).toHaveBeenCalledWith('visibilitychange', expect.any(Function))
  })

  // C20: no rAF outside a browser.
  it('stays stopped instead of throwing when requestAnimationFrame is missing', () => {
    globalThis.requestAnimationFrame = undefined as unknown as typeof requestAnimationFrame
    const collector = new FrameRateCollector()
    expect(() => collector.start()).not.toThrow()
    expect(collector.getStats()).toEqual(EMPTY_FRAME_RATE_STATS)
    expect(() => collector.stop()).not.toThrow()
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
