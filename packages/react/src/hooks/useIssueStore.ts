import { useState, useEffect, useMemo } from 'react'
import type { VibeIssue } from '@wcgw/vibe-check-core'
import { createIssueStore } from '../store/issueStore.js'
import type { IssueStore, IssueStoreState } from '../store/issueStore.js'

// Singleton store instance per page (browser only)
const sharedStores = new Map<string, IssueStore>()

const getStore = (projectId?: string): IssueStore => {
  if (typeof window === 'undefined') {
    return createIssueStore(projectId)
  }
  const key = projectId ?? ''
  const existing = sharedStores.get(key)
  if (existing) return existing
  const store = createIssueStore(projectId)
  sharedStores.set(key, store)
  return store
}

/** Reset singleton — for testing only */
export const __resetIssueStore = (): void => {
  sharedStores.clear()
}

export const useIssueStore = (liveIssues: readonly VibeIssue[], projectId?: string) => {
  const store = useMemo(() => getStore(projectId), [projectId])
  const [state, setState] = useState<IssueStoreState>(store.getState)

  useEffect(() => {
    setState(store.getState())
    return store.subscribe(setState)
  }, [store])

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
