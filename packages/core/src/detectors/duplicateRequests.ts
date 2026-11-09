import { issueLastSeenAt } from '@wcgw/vibe-check-protocol'
import type { DetectorRunStatus } from '@wcgw/vibe-check-protocol'
import type { Detector, VibeIssue } from '../types.js'
import { isProbeInit } from '../utils/probe.js'
import { createIssue } from './createIssue.js'
import { createIssueBook } from './issueBook.js'
import { createRunTracker } from './runStatus.js'

// ── Constants ────────────────────────────────────────────────────────────────

const DUPLICATE_WINDOW_MS = 2_000
// An open issue is dropped once the duplicate has not happened again for this long.
const RETENTION_MS = 60_000
// A repeat this soon after the previous identical call gets one stack check for
// a React StrictMode effect replay (dev-only double invoke, documented React
// behaviour), which is not the app's duplicate.
const STRICT_REPLAY_GAP_MS = 100
const STRICT_REPLAY_FRAMES = /doubleInvokeEffects|invokePassiveEffectMountInDEV|invokeLayoutEffectMountInDEV|invokeEffectsInDev/
const MAX_TRACKED_KEYS = 500
const MAX_URL_IN_COPY = 120
const MAX_HASHED_BODY_CHARS = 100_000

const normalizePrefix = (prefix: string): string => prefix.replace(/\/+$/, '')

const isInsideIgnoredTree = (url: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) => url === prefix || url.startsWith(`${prefix}/`))

const shortUrl = (url: string): string =>
  url.length > MAX_URL_IN_COPY ? `${url.slice(0, MAX_URL_IN_COPY)}...` : url

// FNV-1a over the body text: two GraphQL / JSON-RPC calls to the same endpoint
// with different payloads are different requests.
const hashText = (text: string): string => {
  let hash = 0x811c9dc5
  const end = Math.min(text.length, MAX_HASHED_BODY_CHARS)
  for (let i = 0; i < end; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${(hash >>> 0).toString(36)}:${text.length}`
}

const isBodyless = (method: string): boolean => method === 'GET' || method === 'HEAD'

// Tracking key suffix for the request body. null = the body cannot be compared
// cheaply (stream, Blob, FormData, a Request's own body), so the call is not
// tracked rather than risk calling two different requests "the same".
const bodyKeyOf = (method: string, body: unknown, bodyKnown: boolean): string | null => {
  if (isBodyless(method)) return ''
  if (!bodyKnown) return null
  if (body === undefined || body === null) return ' #'
  if (typeof body === 'string') return ` #${hashText(body)}`
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return ` #${hashText(body.toString())}`
  }
  return null
}

// Every input native fetch accepts: string, URL, Request (any realm), or an
// object with a toString(). Never throws.
const requestUrlOf = (input: unknown): string | null => {
  try {
    if (typeof input === 'string') return input
    if (typeof URL !== 'undefined' && input instanceof URL) return input.href
    if (input !== null && typeof input === 'object') {
      const url = (input as { readonly url?: unknown }).url
      if (typeof url === 'string') return url
    }
    return String(input)
  } catch {
    return null
  }
}

const requestMethodOf = (input: unknown): string | null => {
  if (input === null || typeof input !== 'object') return null
  const method = (input as { readonly method?: unknown }).method
  return typeof method === 'string' ? method : null
}

const isRequestObject = (input: unknown): boolean =>
  input !== null && typeof input === 'object' && requestMethodOf(input) !== null

const looksLikeStrictReplay = (): boolean => {
  const errorCtor = Error as unknown as { stackTraceLimit?: number }
  const previous = errorCtor.stackTraceLimit
  try {
    if (typeof previous === 'number') errorCtor.stackTraceLimit = 60
    return STRICT_REPLAY_FRAMES.test(String(new Error().stack ?? ''))
  } catch {
    return false
  } finally {
    if (typeof previous === 'number') errorCtor.stackTraceLimit = previous
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface RequestRecord {
  readonly timestamps: number[]
}

interface XhrCall {
  readonly method: string
  readonly url: string
}

// In-place compaction: drop timestamps older than the window.
const compactTimestamps = (timestamps: number[], cutoff: number): void => {
  let write = 0
  for (let read = 0; read < timestamps.length; read++) {
    if (timestamps[read]! >= cutoff) {
      if (write !== read) timestamps[write] = timestamps[read]!
      write += 1
    }
  }
  timestamps.length = write
}

// ── Detector ─────────────────────────────────────────────────────────────────

export const createDuplicateRequestsDetector = (
  ignoredUrlPrefixes: readonly string[] = [],
): Detector => {
  const book = createIssueBook()
  const tracker = createRunTracker('duplicate-requests', { settleAfterMs: DUPLICATE_WINDOW_MS })
  const requestMap = new Map<string, RequestRecord>()
  const ignored = ignoredUrlPrefixes.map(normalizePrefix).filter((prefix) => prefix.length > 0)
  const xhrCalls = new WeakMap<XMLHttpRequest, XhrCall>()

  // Saved originals plus the wrappers we installed, so stop() restores only
  // while our wrapper is still the top-most patch (a wrapper installed after
  // ours — Sentry, MSW, Next.js — is never clobbered). A wrapper left in place
  // goes inactive and just passes through.
  let originalFetch: typeof globalThis.fetch | null = null
  let wrappedFetch: typeof globalThis.fetch | null = null
  let originalXhrOpen: typeof XMLHttpRequest.prototype.open | null = null
  let wrappedXhrOpen: typeof XMLHttpRequest.prototype.open | null = null
  let originalXhrSend: typeof XMLHttpRequest.prototype.send | null = null
  let wrappedXhrSend: typeof XMLHttpRequest.prototype.send | null = null
  let patched = false
  let active = false

  const pruneRequestMap = (now: number): void => {
    if (requestMap.size <= MAX_TRACKED_KEYS) return
    const cutoff = now - DUPLICATE_WINDOW_MS
    for (const [key, record] of requestMap) {
      const last = record.timestamps[record.timestamps.length - 1]
      if (last === undefined || last < cutoff) requestMap.delete(key)
    }
    // Still over the cap: drop the oldest keys (Map keeps insertion order).
    for (const key of requestMap.keys()) {
      if (requestMap.size <= MAX_TRACKED_KEYS) break
      requestMap.delete(key)
    }
  }

  const trackRequest = (rawMethod: string, url: string, bodyKey: string): void => {
    if (isInsideIgnoredTree(url, ignored)) return
    const method = rawMethod.toUpperCase()
    const key = `${method} ${url}${bodyKey}`
    const now = Date.now()

    let record = requestMap.get(key)
    if (record) {
      compactTimestamps(record.timestamps, now - DUPLICATE_WINDOW_MS)
      const previous = record.timestamps[record.timestamps.length - 1]
      if (previous !== undefined && now - previous <= STRICT_REPLAY_GAP_MS && looksLikeStrictReplay()) {
        return
      }
      record.timestamps.push(now)
    } else {
      record = { timestamps: [now] }
      requestMap.set(key, record)
      pruneRequestMap(now)
    }

    const count = record.timestamps.length
    if (count < 2) return
    const display = shortUrl(url)
    book.report(createIssue(
      'duplicate-requests',
      'warning',
      `Duplicate ${method} request: ${display}`,
      `${display} was requested ${count} times within ${DUPLICATE_WINDOW_MS}ms. This may indicate unnecessary refetching or missing request deduplication.`,
      { url, method, count, windowMs: DUPLICATE_WINDOW_MS },
      now,
    ))
  }

  const observeFetch = (input: unknown, init: RequestInit | undefined): void => {
    if (!active || isProbeInit(init)) return
    const url = requestUrlOf(input)
    if (url === null) return
    const method = (init?.method ?? requestMethodOf(input) ?? 'GET').toUpperCase()
    // A Request object's own body is a stream we must not read.
    const bodyKnown = init?.body !== undefined || !isRequestObject(input)
    const bodyKey = bodyKeyOf(method, init?.body, bodyKnown)
    if (bodyKey === null) return
    trackRequest(method, url, bodyKey)
  }

  const patchFetch = (): void => {
    if (typeof globalThis.fetch !== 'function') return
    const original = globalThis.fetch
    originalFetch = original

    const wrapper: typeof globalThis.fetch = (input, init?) => {
      try {
        observeFetch(input, init)
      } catch {
        // Tracking must never break the app's request.
      }
      return original(input, init)
    }
    wrappedFetch = wrapper
    globalThis.fetch = wrapper
  }

  const patchXhr = (): void => {
    if (typeof XMLHttpRequest === 'undefined') return
    const proto = XMLHttpRequest.prototype
    const open = proto.open
    if (typeof open !== 'function') return
    originalXhrOpen = open

    const openWrapper = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ): void {
      try {
        if (active) {
          const href = requestUrlOf(url)
          const upper = String(method).toUpperCase()
          if (href !== null) {
            if (isBodyless(upper)) trackRequest(upper, href, '')
            else xhrCalls.set(this, { method: upper, url: href })
          }
        }
      } catch {
        // Tracking must never break the app's request.
      }
      return open.apply(this, [method, url, ...rest] as unknown as Parameters<typeof XMLHttpRequest.prototype.open>)
    }
    wrappedXhrOpen = openWrapper as typeof XMLHttpRequest.prototype.open
    proto.open = wrappedXhrOpen

    const send = proto.send
    if (typeof send !== 'function') return
    originalXhrSend = send
    const sendWrapper = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ): void {
      try {
        const call = xhrCalls.get(this)
        if (active && call !== undefined) {
          xhrCalls.delete(this)
          const bodyKey = bodyKeyOf(call.method, body, true)
          if (bodyKey !== null) trackRequest(call.method, call.url, bodyKey)
        }
      } catch {
        // Tracking must never break the app's request.
      }
      return send.call(this, body)
    }
    wrappedXhrSend = sendWrapper as typeof XMLHttpRequest.prototype.send
    proto.send = wrappedXhrSend
  }

  const unpatch = (): void => {
    if (originalFetch !== null && globalThis.fetch === wrappedFetch) {
      globalThis.fetch = originalFetch
    }
    if (typeof XMLHttpRequest !== 'undefined') {
      const proto = XMLHttpRequest.prototype
      if (originalXhrOpen !== null && proto.open === wrappedXhrOpen) proto.open = originalXhrOpen
      if (originalXhrSend !== null && proto.send === wrappedXhrSend) proto.send = originalXhrSend
    }
  }

  const pruneExpired = (now: number): void => {
    const cutoff = now - RETENTION_MS
    book.retractWhere((issue) => issueLastSeenAt(issue) < cutoff)
  }

  return {
    name: 'duplicate-requests',

    start(): void {
      if (patched) return
      patched = true
      active = true
      patchFetch()
      patchXhr()
      tracker.start(Date.now(), originalFetch !== null || originalXhrOpen !== null)
    },

    stop(): void {
      active = false
      try {
        unpatch()
      } finally {
        originalFetch = null
        wrappedFetch = null
        originalXhrOpen = null
        wrappedXhrOpen = null
        originalXhrSend = null
        wrappedXhrSend = null
        patched = false
        requestMap.clear()
        tracker.stop()
      }
    },

    getIssues(): readonly VibeIssue[] {
      pruneExpired(Date.now())
      return book.list()
    },

    clear(): void {
      book.clear()
      requestMap.clear()
      tracker.reset()
    },

    getStatus(): DetectorRunStatus {
      return tracker.status()
    },
  }
}
