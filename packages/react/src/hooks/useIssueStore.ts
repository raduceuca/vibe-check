import { useState, useEffect, useRef, useMemo } from 'react'
import type { VibeIssue } from '@wcgw/vibe-check-core'
import { createIssueStore } from '../store/issueStore.js'
import type { IssueStore, IssueStoreState } from '../store/issueStore.js'

// Singleton store instance per page (browser only)
let sharedStore: IssueStore | null = null

const getStore = (): IssueStore => {
  if (typeof window === 'undefined') {
    return createIssueStore()
  }
  if (!sharedStore) {
    sharedStore = createIssueStore()
  }
  return sharedStore
}

/** Reset singleton — for testing only */
export const __resetIssueStore = (): void => {
  sharedStore = null
}

export const useIssueStore = (liveIssues: readonly VibeIssue[]) => {
  const store = useRef(getStore()).current
  const [state, setState] = useState<IssueStoreState>(store.getState)

  useEffect(() => store.subscribe(setState), [store])

  // Sync live issues into the store
  useEffect(() => {
    store.sync(liveIssues)
  }, [store, liveIssues])

  return useMemo(() => ({
    tracked: state.issues,
    active: state.issues.filter((t) => t.status === 'new'),
    sent: state.issues.filter((t) => t.status === 'sent-to-agent'),
    resolved: state.issues.filter((t) => t.status === 'resolved'),
    markSent: store.markSent,
    markSentBatch: store.markSentBatch,
    markResolved: store.markResolved,
    clearResolved: store.clearResolved,
    clearAll: store.clearAll,
  }), [state, store])
}
