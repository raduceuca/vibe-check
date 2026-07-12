import { useState, useEffect, useRef } from 'react'

// ── Honest FPS history — real samples, persisted to localStorage ─────────────
// Two resolutions so the lifeline can zoom from live to an hour without storing
// or rendering tens of thousands of points: a full-res recent buffer (the live
// view) and a coarse buffer (one sample every LONG_STEP_SEC) for the 15m/1h
// views. Persisted (throttled) so the timeline survives reloads; samples are the
// measured frame rate verbatim — no smoothing.

export interface FpsSample { readonly time: number; readonly value: number }
export interface FpsHistory { readonly live: readonly FpsSample[]; readonly long: readonly FpsSample[] }
const EMPTY_HISTORY: FpsHistory = { live: [], long: [] }

const FPS_HISTORY_KEY = 'vibe-check:fps-history'
const LIVE_CAP = 1200 // ~10 min at the 500ms snapshot tick
const LONG_STEP_SEC = 15 // one coarse sample every 15s
const LONG_CAP = 280 // ~70 min of coarse samples
const STALE_SEC = 3600 // drop a stored session whose newest sample is older than this
const PERSIST_EVERY_MS = 8000

const isSample = (p: unknown): p is FpsSample =>
  !!p && typeof (p as FpsSample).time === 'number' && typeof (p as FpsSample).value === 'number'

// Restore the timeline across reloads. Validates shape, caps each buffer, and
// drops a stale session — there's a real downtime gap between sessions, so
// resurrecting an hours-old line as "live" would be dishonest.
const loadFpsHistory = (): FpsHistory => {
  try {
    if (typeof localStorage === 'undefined') return EMPTY_HISTORY
    const parsed = JSON.parse(localStorage.getItem(FPS_HISTORY_KEY) || 'null')
    if (!parsed || !Array.isArray(parsed.live) || !Array.isArray(parsed.long)) return EMPTY_HISTORY
    const live = parsed.live.filter(isSample).slice(-LIVE_CAP)
    const long = parsed.long.filter(isSample).slice(-LONG_CAP)
    const newest = Math.max(live[live.length - 1]?.time ?? 0, long[long.length - 1]?.time ?? 0)
    if (!newest || newest < Date.now() / 1000 - STALE_SEC) return EMPTY_HISTORY
    return { live, long }
  } catch { return EMPTY_HISTORY }
}

export const useFpsHistory = (fps: number, tick: number, persist: boolean): FpsHistory => {
  const [history, setHistory] = useState<FpsHistory>(() => (persist ? loadFpsHistory() : EMPTY_HISTORY))
  const lastPersist = useRef(0)

  useEffect(() => {
    if (tick === 0) return // no real snapshot yet
    const time = tick / 1000 // Liveline windows by `time` in Unix *seconds*
    const value = Math.round(fps)
    setHistory((prev) => {
      const live = [...prev.live, { time, value }].slice(-LIVE_CAP)
      const lastLong = prev.long[prev.long.length - 1]
      const long = !lastLong || time - lastLong.time >= LONG_STEP_SEC
        ? [...prev.long, { time, value }].slice(-LONG_CAP)
        : prev.long
      return { live, long }
    })
  }, [tick, fps])

  // Throttled persistence — writing the full buffer every tick would be a waste
  // for a perf tool to inflict on the page it's measuring.
  useEffect(() => {
    if (!persist || tick === 0 || tick - lastPersist.current < PERSIST_EVERY_MS) return
    lastPersist.current = tick
    try { localStorage.setItem(FPS_HISTORY_KEY, JSON.stringify(history)) } catch { /* full/blocked */ }
  }, [tick, persist, history])

  useEffect(() => {
    if (!persist) { try { localStorage.removeItem(FPS_HISTORY_KEY) } catch { /* noop */ } }
  }, [persist])

  return history
}
