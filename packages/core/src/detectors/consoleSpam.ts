import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_THRESHOLD = 20
const WINDOW_SECONDS = 10
const WINDOW_MS = WINDOW_SECONDS * 1_000
const MAX_SAMPLE_ARGS = 3
const MAX_ARG_LENGTH = 200

// ── Types ────────────────────────────────────────────────────────────────────

type ConsoleMethod = 'log' | 'warn' | 'error'

interface CallRecord {
  readonly timestamp: number
  readonly method: ConsoleMethod
  readonly args: readonly string[]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const stringifyArg = (arg: unknown): string => {
  try {
    const str = typeof arg === 'string' ? arg : JSON.stringify(arg)
    return str.length > MAX_ARG_LENGTH ? str.slice(0, MAX_ARG_LENGTH) + '...' : str
  } catch {
    return String(arg).slice(0, MAX_ARG_LENGTH)
  }
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createConsoleSpamDetector = (
  threshold: number = DEFAULT_THRESHOLD,
): Detector => {
  let issues: VibeIssue[] = []
  let calls: CallRecord[] = []
  let checkTimerId: ReturnType<typeof setInterval> | null = null

  // Saved originals for restoration
  let originalLog: typeof console.log | null = null
  let originalWarn: typeof console.warn | null = null
  let originalError: typeof console.error | null = null
  let patched = false

  const recordCall = (method: ConsoleMethod, args: unknown[]): void => {
    const sampleArgs = args.slice(0, MAX_SAMPLE_ARGS).map(stringifyArg)
    calls = [...calls, { timestamp: Date.now(), method, args: sampleArgs }]
  }

  const patchMethod = (method: ConsoleMethod): void => {
    const original = console[method]

    // Save originals
    if (method === 'log') originalLog = original
    if (method === 'warn') originalWarn = original
    if (method === 'error') originalError = original

    const wrapped = (...args: unknown[]): void => {
      recordCall(method, args)
      original.apply(console, args)
    }

    console[method] = wrapped
  }

  const checkForSpam = (): void => {
    const now = Date.now()
    const cutoff = now - WINDOW_MS

    // Filter to current window
    const windowCalls = calls.filter((c) => c.timestamp >= cutoff)
    calls = windowCalls

    if (windowCalls.length >= threshold) {
      // Count per method for evidence
      const methodCounts = new Map<ConsoleMethod, number>()
      const methodSamples = new Map<ConsoleMethod, readonly string[]>()

      for (const call of windowCalls) {
        const count = methodCounts.get(call.method) ?? 0
        methodCounts.set(call.method, count + 1)
        if (!methodSamples.has(call.method)) {
          methodSamples.set(call.method, call.args)
        }
      }

      // Report per method that has significant calls
      for (const [method, count] of methodCounts) {
        if (count >= threshold / 3) {
          issues = [
            ...issues,
            createIssue(
              'console-spam',
              'warning',
              `console.${method} spam detected`,
              `console.${method} was called ${count} times in ${WINDOW_SECONDS}s. Excessive console output degrades DevTools performance and can mask real issues.`,
              {
                method,
                callCount: count,
                windowSeconds: WINDOW_SECONDS,
                sampleArgs: methodSamples.get(method) ?? [],
              },
            ),
          ]
        }
      }
    }
  }

  return {
    name: 'console-spam',

    start(): void {
      if (patched) return
      patched = true

      patchMethod('log')
      patchMethod('warn')
      patchMethod('error')

      checkTimerId = setInterval(checkForSpam, WINDOW_MS)
    },

    stop(): void {
      try {
        if (originalLog !== null) {
          console.log = originalLog
          originalLog = null
        }
        if (originalWarn !== null) {
          console.warn = originalWarn
          originalWarn = null
        }
        if (originalError !== null) {
          console.error = originalError
          originalError = null
        }
        if (checkTimerId !== null) {
          clearInterval(checkTimerId)
          checkTimerId = null
        }
      } finally {
        patched = false
        calls = []
      }
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      calls = []
    },
  }
}
