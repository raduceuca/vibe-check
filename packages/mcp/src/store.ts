import type { VibeIssue, VibeSnapshot } from './types.js'

const MAX_ISSUE_HISTORY = 100

export interface VibeStore {
  readonly latestSnapshot: VibeSnapshot | null
  readonly issueHistory: readonly VibeIssue[]
  readonly acknowledgedIds: ReadonlySet<string>
  readonly resolvedIds: ReadonlySet<string>
}

export const createStore = (): VibeStore => ({
  latestSnapshot: null,
  issueHistory: [],
  acknowledgedIds: new Set<string>(),
  resolvedIds: new Set<string>(),
})

export const updateSnapshot = (store: VibeStore, snapshot: VibeSnapshot): VibeStore => {
  const combined = [...store.issueHistory, ...snapshot.issues]
  const issueHistory = combined.length > MAX_ISSUE_HISTORY
    ? combined.slice(combined.length - MAX_ISSUE_HISTORY)
    : combined

  return {
    ...store,
    latestSnapshot: snapshot,
    issueHistory,
  }
}

export const acknowledgeIssue = (store: VibeStore, id: string): VibeStore => ({
  ...store,
  acknowledgedIds: new Set([...store.acknowledgedIds, id]),
})

export const resolveIssue = (store: VibeStore, id: string): VibeStore => ({
  ...store,
  resolvedIds: new Set([...store.resolvedIds, id]),
})
