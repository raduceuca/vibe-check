import type { VibeIssue, DetectorName } from '@wcgw/vibe-check-core'

// ── Types ───────────────────────────────────────────────────────────────────

export type IssueStatus = 'new' | 'sent-to-agent' | 'resolved'

export interface TrackedIssue {
  readonly issue: VibeIssue
  readonly status: IssueStatus
  readonly firstSeen: number
  readonly lastSeen: number
  readonly sentAt: number | null
  readonly resolvedAt: number | null
}

export interface IssueStoreState {
  readonly issues: readonly TrackedIssue[]
  readonly clearedIds: readonly string[]
}

// ── Storage Key ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vibe-check:issues'
const MAX_ISSUES = 200

// ── Helpers ─────────────────────────────────────────────────────────────────

const isValidTrackedIssue = (item: unknown): item is TrackedIssue => {
  if (typeof item !== 'object' || item === null) return false
  const t = item as Record<string, unknown>
  return (
    typeof t.status === 'string' &&
    typeof t.firstSeen === 'number' &&
    typeof t.lastSeen === 'number' &&
    typeof t.issue === 'object' &&
    t.issue !== null &&
    typeof (t.issue as Record<string, unknown>).id === 'string' &&
    typeof (t.issue as Record<string, unknown>).detector === 'string'
  )
}

const readFromStorage = (): IssueStoreState => {
  try {
    if (typeof localStorage === 'undefined') return { issues: [], clearedIds: [] }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { issues: [], clearedIds: [] }
    const parsed = JSON.parse(raw) as Partial<IssueStoreState>
    return {
      issues: Array.isArray(parsed.issues) ? parsed.issues.filter(isValidTrackedIssue) : [],
      clearedIds: Array.isArray(parsed.clearedIds)
        ? parsed.clearedIds.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    return { issues: [], clearedIds: [] }
  }
}

const writeToStorage = (state: IssueStoreState): void => {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or unavailable — silently continue
  }
}

// ── Deduplication key ───────────────────────────────────────────────────────

const issueKey = (issue: VibeIssue): string =>
  `${issue.detector}:${issue.title}`

// ── Store ─────────���─────────────────────────��───────────────────────────────

type StoreListener = (state: IssueStoreState) => void

export interface IssueStore {
  getState(): IssueStoreState
  subscribe(listener: StoreListener): () => void
  sync(liveIssues: readonly VibeIssue[]): void
  markSent(issueId: string): void
  markSentBatch(issueIds: readonly string[]): void
  markResolved(issueId: string): void
  clearResolved(): void
  clearAll(): void
  getByDetector(detector: DetectorName): readonly TrackedIssue[]
  getActive(): readonly TrackedIssue[]
  getSent(): readonly TrackedIssue[]
  getResolved(): readonly TrackedIssue[]
}

export const createIssueStore = (): IssueStore => {
  let state = readFromStorage()
  const listeners = new Set<StoreListener>()

  const notify = (): void => {
    for (const listener of listeners) {
      listener(state)
    }
  }

  const update = (next: IssueStoreState): void => {
    state = next
    writeToStorage(state)
    notify()
  }

  return {
    getState(): IssueStoreState {
      return state
    },

    subscribe(listener: StoreListener): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },

    sync(liveIssues: readonly VibeIssue[]): void {
      // Cheap early-out: if the live keys exactly match the currently-tracked
      // 'new' keys (and every live key maps to an already-known tracked item),
      // nothing observable has changed. The engine emits a fresh issues array
      // every 500ms even when contents are identical — without this guard,
      // every tick would rebuild the store and re-notify every subscriber.
      const clearedSet = new Set(state.clearedIds)
      const existingByKey = new Map<string, TrackedIssue>()
      for (const tracked of state.issues) {
        existingByKey.set(issueKey(tracked.issue), tracked)
      }

      let changed = false
      let liveMatchCount = 0
      for (const live of liveIssues) {
        const key = issueKey(live)
        if (clearedSet.has(key)) continue
        const existing = existingByKey.get(key)
        if (!existing) {
          changed = true
          break
        }
        liveMatchCount += 1
      }

      if (!changed) {
        // Count currently tracked 'new' issues whose key is still live.
        const liveKeySet = new Set<string>()
        for (const live of liveIssues) liveKeySet.add(issueKey(live))
        let trackedNewCount = 0
        for (const tracked of state.issues) {
          if (tracked.status === 'new' && liveKeySet.has(issueKey(tracked.issue))) {
            trackedNewCount += 1
          }
        }
        if (trackedNewCount === liveMatchCount) return
      }

      const now = Date.now()
      const nextIssues: TrackedIssue[] = []

      // Merge live issues with existing tracked state
      for (const live of liveIssues) {
        const key = issueKey(live)
        if (clearedSet.has(key)) continue

        const existing = existingByKey.get(key)
        if (existing) {
          // Update lastSeen, keep status
          nextIssues.push({
            ...existing,
            issue: live,
            lastSeen: now,
          })
          existingByKey.delete(key)
        } else {
          // New issue
          nextIssues.push({
            issue: live,
            status: 'new',
            firstSeen: now,
            lastSeen: now,
            sentAt: null,
            resolvedAt: null,
          })
        }
      }

      // Keep previously tracked issues that are sent or resolved (even if no longer live)
      for (const [, tracked] of existingByKey) {
        if (tracked.status !== 'new') {
          nextIssues.push(tracked)
        }
      }

      // Cap size
      const capped = nextIssues.slice(0, MAX_ISSUES)

      update({ ...state, issues: capped })
    },

    markSent(issueId: string): void {
      const now = Date.now()
      update({
        ...state,
        issues: state.issues.map((t) =>
          t.issue.id === issueId
            ? { ...t, status: 'sent-to-agent' as const, sentAt: now }
            : t
        ),
      })
    },

    markSentBatch(issueIds: readonly string[]): void {
      const now = Date.now()
      const idSet = new Set(issueIds)
      update({
        ...state,
        issues: state.issues.map((t) =>
          idSet.has(t.issue.id) && t.status === 'new'
            ? { ...t, status: 'sent-to-agent' as const, sentAt: now }
            : t
        ),
      })
    },

    markResolved(issueId: string): void {
      const now = Date.now()
      update({
        ...state,
        issues: state.issues.map((t) =>
          t.issue.id === issueId
            ? { ...t, status: 'resolved' as const, resolvedAt: now }
            : t
        ),
      })
    },

    clearResolved(): void {
      const resolved = state.issues.filter((t) => t.status === 'resolved')
      const resolvedKeys = resolved.map((t) => issueKey(t.issue))

      update({
        issues: state.issues.filter((t) => t.status !== 'resolved'),
        clearedIds: [...state.clearedIds, ...resolvedKeys].slice(-MAX_ISSUES),
      })
    },

    clearAll(): void {
      const allKeys = state.issues.map((t) => issueKey(t.issue))
      update({
        issues: [],
        clearedIds: [...state.clearedIds, ...allKeys].slice(-MAX_ISSUES),
      })
    },

    getByDetector(detector: DetectorName): readonly TrackedIssue[] {
      return state.issues.filter((t) => t.issue.detector === detector)
    },

    getActive(): readonly TrackedIssue[] {
      return state.issues.filter((t) => t.status === 'new')
    },

    getSent(): readonly TrackedIssue[] {
      return state.issues.filter((t) => t.status === 'sent-to-agent')
    },

    getResolved(): readonly TrackedIssue[] {
      return state.issues.filter((t) => t.status === 'resolved')
    },
  }
}
