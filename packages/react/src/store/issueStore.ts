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

export const issueStorageKey = (projectId?: string): string => projectId
  ? `${STORAGE_KEY}:${encodeURIComponent(projectId)}`
  : STORAGE_KEY

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

const readFromStorage = (storageKey: string): IssueStoreState => {
  try {
    if (typeof localStorage === 'undefined') return { issues: [], clearedIds: [] }
    const raw = localStorage.getItem(storageKey)
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

const writeToStorage = (storageKey: string, state: IssueStoreState): void => {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(storageKey, JSON.stringify(state))
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

export const createIssueStore = (projectId?: string): IssueStore => {
  const storageKey = issueStorageKey(projectId)
  let state = readFromStorage(storageKey)
  const listeners = new Set<StoreListener>()

  const notify = (): void => {
    for (const listener of listeners) {
      listener(state)
    }
  }

  const update = (next: IssueStoreState): void => {
    state = next
    writeToStorage(storageKey, state)
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
      // Cheap early-out. The engine emits a fresh issues array every 500ms even
      // when nothing changed, so a full rebuild here would writeToStorage +
      // notify() (re-rendering every subscriber) twice a second. The store only
      // needs to rebuild when the observable set changes:
      //   (a) a genuinely new live key appears (not cleared, not already tracked), or
      //   (b) a tracked 'new' issue is no longer live (so it must be pruned).
      // A live issue already tracked under ANY status — including sent-to-agent
      // and resolved — is not a change. That is what stops "copy prompt" (which
      // marks an issue sent while it stays live) from mismatching a 'new'-only
      // count and thrashing localStorage for the rest of the session. A pure
      // lastSeen refresh is unobservable and deliberately triggers no write.
      const clearedSet = new Set(state.clearedIds)
      const liveKeys = new Set<string>()
      for (const live of liveIssues) {
        const key = issueKey(live)
        if (!clearedSet.has(key)) liveKeys.add(key)
      }
      const trackedKeys = new Set<string>()
      for (const tracked of state.issues) trackedKeys.add(issueKey(tracked.issue))

      let hasNewKey = false
      for (const key of liveKeys) {
        if (!trackedKeys.has(key)) { hasNewKey = true; break }
      }
      let hasDroppedNew = false
      if (!hasNewKey) {
        for (const tracked of state.issues) {
          if (tracked.status === 'new' && !liveKeys.has(issueKey(tracked.issue))) {
            hasDroppedNew = true
            break
          }
        }
      }
      if (!hasNewKey && !hasDroppedNew) return

      const existingByKey = new Map<string, TrackedIssue>()
      for (const tracked of state.issues) {
        existingByKey.set(issueKey(tracked.issue), tracked)
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
