import type { VibeSnapshot, VibeIssue } from './types.js'
import {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
} from './types.js'
import type { VibeEngine } from './engine.js'
import type { BeaconStatus } from './beacon/beaconClient.js'

// ── Scenario shape ───────────────────────────────────────────────────────────

// One step in a scripted timeline. Its `snapshot` is merged over the running
// snapshot (so unspecified metrics persist frame-to-frame), and `issues`, when
// present, replaces the current issue list. `afterMs` is the delay from the
// previous frame; when omitted the scenario's `stepMs` is used.
export interface ScriptedFrame {
  readonly afterMs?: number
  readonly snapshot?: Partial<VibeSnapshot>
  readonly issues?: readonly VibeIssue[]
}

export interface ScriptedScenario {
  readonly frames: readonly ScriptedFrame[]
  // Default delay between frames when a frame omits `afterMs`. Default 1000ms.
  readonly stepMs?: number
  // Replay the timeline from the top after the last frame. Default false.
  readonly loop?: boolean
}

const EMPTY_SCRIPTED_SNAPSHOT: VibeSnapshot = {
  timestamp: 0,
  frameRate: EMPTY_FRAME_RATE_STATS,
  longFrames: EMPTY_LONG_FRAME_STATS,
  webVitals: EMPTY_WEB_VITALS,
  memory: null,
  resources: EMPTY_RESOURCE_STATS,
  console: EMPTY_CONSOLE_STATS,
  issues: [],
  domNodeCount: 0,
}

// ── Scripted engine ──────────────────────────────────────────────────────────

// A VibeEngine that plays back a canned timeline of snapshots + issues instead of
// reading live collectors, so landing-page and docs demos are deterministic and
// replay identically for every visitor. It implements the exact public surface
// the React widget consumes, so it drops into the same `engine` slot as the real
// VibeCheckEngine.
export const createScriptedEngine = (scenario: ScriptedScenario): VibeEngine => {
  const stepMs = scenario.stepMs ?? 1000
  const frames = scenario.frames
  const listeners = new Set<(snapshot: VibeSnapshot) => void>()

  let running = false
  let current: VibeSnapshot = EMPTY_SCRIPTED_SNAPSHOT
  let timers: ReturnType<typeof setTimeout>[] = []

  const notify = (): void => {
    for (const listener of listeners) listener(current)
  }

  const applyFrame = (frame: ScriptedFrame): void => {
    current = {
      ...current,
      ...frame.snapshot,
      timestamp: frame.snapshot?.timestamp ?? Date.now(),
      issues: frame.issues ?? current.issues,
    }
    notify()
  }

  const clearTimers = (): void => {
    for (const timer of timers) clearTimeout(timer)
    timers = []
  }

  const play = (): void => {
    if (frames.length === 0) return
    // Frame 0 applies synchronously on start so getSnapshot() and any listener
    // registered before start() see the opening state immediately.
    applyFrame(frames[0]!)

    let elapsed = 0
    for (let i = 1; i < frames.length; i++) {
      const frame = frames[i]!
      elapsed += frame.afterMs ?? stepMs
      timers.push(setTimeout(() => applyFrame(frame), elapsed))
    }

    if (scenario.loop) {
      const total = elapsed + (frames[0]!.afterMs ?? stepMs)
      timers.push(setTimeout(() => {
        if (!running) return
        current = EMPTY_SCRIPTED_SNAPSHOT
        play()
      }, total))
    }
  }

  return {
    start(): void {
      if (running) return
      running = true
      current = EMPTY_SCRIPTED_SNAPSHOT
      play()
    },

    stop(): void {
      if (!running) return
      running = false
      clearTimers()
    },

    getSnapshot(): VibeSnapshot {
      return current
    },

    getIssues(): readonly VibeIssue[] {
      return current.issues
    },

    clearIssues(): void {
      current = { ...current, issues: [] }
    },

    onSnapshot(callback: (snapshot: VibeSnapshot) => void): () => void {
      listeners.add(callback)
      return () => {
        listeners.delete(callback)
      }
    },

    isRunning(): boolean {
      return running
    },

    getBeaconStatus(): BeaconStatus | null {
      return null
    },
  }
}
