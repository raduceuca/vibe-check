import { issueLastSeenAt } from '@wcgw/vibe-check-protocol'
import type { DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker } from './runStatus.js'

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 20
const WINDOW_SECONDS = 10
const WINDOW_MS = WINDOW_SECONDS * 1_000
// A method's issue is dropped once it has not spammed for this long (3 quiet checks).
const RETENTION_MS = 30_000
const MAX_SAMPLE_ARGS = 3
const MAX_ARG_LENGTH = 200
const MAX_PREVIEW_ITEMS = 10
const MAX_PREVIEW_DEPTH = 2

// ── Types ────────────────────────────────────────────────────────────────────

type ConsoleMethod = 'log' | 'warn' | 'error'

const METHODS: readonly ConsoleMethod[] = ['log', 'warn', 'error']
const BUCKET_COUNT = WINDOW_SECONDS + 1

// One-second count buckets in a fixed ring (window + 1 slots, so the window's
// oldest second is never overwritten): recording a call is O(1) with no
// allocation, so heavy logging stays cheap no matter how long it lasts.
interface Bucket {
  second: number
  log: number
  warn: number
  error: number
}

interface Sample {
  readonly at: number
  readonly args: readonly string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const clip = (text: string): string =>
  text.length > MAX_ARG_LENGTH ? `${text.slice(0, MAX_ARG_LENGTH)}...` : text

// A size-bounded preview: never serializes more than a few items per level, so
// logging a huge state object costs the same as logging a short one.
const preview = (value: unknown, depth: number): string => {
  if (typeof value === 'string') return JSON.stringify(value.length > MAX_ARG_LENGTH ? value.slice(0, MAX_ARG_LENGTH) : value)
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (typeof value === 'symbol') return value.toString()
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof Node !== 'undefined' && value instanceof Node) {
    return value.nodeType === 1 ? `<${(value as Element).tagName.toLowerCase()}>` : `[${value.nodeName}]`
  }
  if (depth >= MAX_PREVIEW_DEPTH) return Array.isArray(value) ? '[…]' : '{…}'
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_PREVIEW_ITEMS).map((item) => preview(item, depth + 1))
    return `[${items.join(',')}${value.length > MAX_PREVIEW_ITEMS ? ',…' : ''}]`
  }
  const keys = Object.keys(value as object)
  const parts = keys.slice(0, MAX_PREVIEW_ITEMS).map((key) => {
    let inner: string
    try {
      inner = preview((value as Record<string, unknown>)[key], depth + 1)
    } catch {
      inner = '?'
    }
    return `${JSON.stringify(key)}:${inner}`
  })
  return `{${parts.join(',')}${keys.length > MAX_PREVIEW_ITEMS ? ',…' : ''}}`
}

const describeArg = (arg: unknown): string => {
  try {
    return clip(typeof arg === 'string' ? arg : preview(arg, 0))
  } catch {
    return clip(Object.prototype.toString.call(arg))
  }
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createConsoleSpamDetector = (
  threshold: number = DEFAULT_THRESHOLD,
): Detector => {
  const book = createIssueBook()
  const tracker = createRunTracker('console-spam')
  const buckets: Bucket[] = Array.from({ length: BUCKET_COUNT }, () => ({ second: -1, log: 0, warn: 0, error: 0 }))
  const samples: Record<ConsoleMethod, Sample | null> = { log: null, warn: null, error: null }
  let checkTimerId: ReturnType<typeof setInterval> | null = null

  // Saved originals for restoration, plus the wrappers we installed so stop()
  // can verify we are still the top-most patch before restoring (ownership
  // check — otherwise we would clobber a wrapper layered on top of ours).
  let originalLog: typeof console.log | null = null
  let originalWarn: typeof console.warn | null = null
  let originalError: typeof console.error | null = null
  let wrappedLog: typeof console.log | null = null
  let wrappedWarn: typeof console.warn | null = null
  let wrappedError: typeof console.error | null = null
  let patched = false

  const resetCounts = (): void => {
    for (const bucket of buckets) {
      bucket.second = -1
      bucket.log = 0
      bucket.warn = 0
      bucket.error = 0
    }
    samples.log = null
    samples.warn = null
    samples.error = null
  }

  const recordCall = (method: ConsoleMethod, args: readonly unknown[]): void => {
    const now = Date.now()
    const second = Math.floor(now / 1_000)
    const bucket = buckets[second % BUCKET_COUNT]!
    if (bucket.second !== second) {
      bucket.second = second
      bucket.log = 0
      bucket.warn = 0
      bucket.error = 0
    }
    bucket[method] += 1
    // Serialize only the first call per method per window (bounded preview).
    const sample = samples[method]
    if (sample === null || now - sample.at >= WINDOW_MS) {
      samples[method] = { at: now, args: args.slice(0, MAX_SAMPLE_ARGS).map(describeArg) }
    }
  }

  const countsInWindow = (now: number): Record<ConsoleMethod, number> => {
    const oldest = Math.floor((now - WINDOW_MS) / 1_000)
    const counts: Record<ConsoleMethod, number> = { log: 0, warn: 0, error: 0 }
    for (const bucket of buckets) {
      if (bucket.second < oldest) continue
      counts.log += bucket.log
      counts.warn += bucket.warn
      counts.error += bucket.error
    }
    return counts
  }

  const patchMethod = (method: ConsoleMethod): void => {
    const original = console[method]

    // Save originals
    if (method === 'log') originalLog = original
    if (method === 'warn') originalWarn = original
    if (method === 'error') originalError = original

    const wrapped = (...args: unknown[]): void => {
      try {
        recordCall(method, args)
      } catch {
        // Counting must never break the app's logging.
      }
      original.apply(console, args)
    }

    if (method === 'log') wrappedLog = wrapped
    if (method === 'warn') wrappedWarn = wrapped
    if (method === 'error') wrappedError = wrapped

    console[method] = wrapped
  }

  const checkForSpam = (): void => {
    const now = Date.now()
    const counts = countsInWindow(now)
    const total = counts.log + counts.warn + counts.error

    if (total >= threshold) {
      for (const method of METHODS) {
        const count = counts[method]
        if (count < threshold / 3) continue
        book.report(createIssue(
          'console-spam',
          'warning',
          `console.${method} spam detected`,
          `console.${method} was called ${count} times in ${WINDOW_SECONDS}s. Excessive console output degrades DevTools performance and can mask real issues.`,
          {
            method,
            callCount: count,
            windowSeconds: WINDOW_SECONDS,
            sampleArgs: samples[method]?.args ?? [],
          },
          now,
        ))
      }
    }

    const cutoff = now - RETENTION_MS
    book.retractWhere((issue) => issueLastSeenAt(issue) < cutoff)
    tracker.evaluated(now)
  }

  return {
    name: 'console-spam',

    start(): void {
      if (patched) return
      if (typeof console === 'undefined') return
      patched = true

      patchMethod('log')
      patchMethod('warn')
      patchMethod('error')

      tracker.start()
      checkTimerId = setInterval(checkForSpam, WINDOW_MS)
    },

    stop(): void {
      try {
        // Restore only if our wrapper is still installed (ownership check).
        if (originalLog !== null && console.log === wrappedLog) {
          console.log = originalLog
        }
        if (originalWarn !== null && console.warn === wrappedWarn) {
          console.warn = originalWarn
        }
        if (originalError !== null && console.error === wrappedError) {
          console.error = originalError
        }
        if (checkTimerId !== null) {
          clearInterval(checkTimerId)
          checkTimerId = null
        }
      } finally {
        originalLog = null
        originalWarn = null
        originalError = null
        wrappedLog = null
        wrappedWarn = null
        wrappedError = null
        patched = false
        resetCounts()
        tracker.stop()
      }
    },

    getIssues(): readonly VibeIssue[] {
      return book.list()
    },

    clear(): void {
      book.clear()
      resetCounts()
      tracker.reset()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },
  }
}
