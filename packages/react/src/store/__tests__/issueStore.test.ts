import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { VibeIssue } from '@wcgw/vibe-check-core'
import { createIssueStore } from '../issueStore.js'

// Minimal live issue; issueKey is `${detector}:${title}`, so distinct titles
// produce distinct tracked entries.
const mk = (id: string, title: string, detector = 'seo'): VibeIssue => ({
  id,
  detector: detector as VibeIssue['detector'],
  severity: 'warning',
  title,
  description: '',
  evidence: {},
  timestamp: 0,
  acknowledged: false,
  resolved: false,
})

describe('issueStore.sync early-out', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('adds a genuinely new live issue as "new" and persists once', () => {
    const store = createIssueStore()
    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    store.sync([mk('a', 'Missing meta description')])

    expect(store.getActive()).toHaveLength(1)
    expect(store.getActive()[0].status).toBe('new')
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('does not write or notify when the live set is unchanged', () => {
    const store = createIssueStore()
    store.sync([mk('a', 'Missing meta description')])

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    let notifies = 0
    store.subscribe(() => { notifies++ })

    for (let i = 0; i < 10; i++) store.sync([mk('a', 'Missing meta description')])

    expect(setItem).not.toHaveBeenCalled()
    expect(notifies).toBe(0)
  })

  // Regression: marking a still-live issue sent used to mismatch the 'new'-only
  // count against the any-status live count, so every 500ms sync() rebuilt the
  // store — a permanent 2Hz localStorage write + full re-render for the rest of
  // the session. A live issue tracked under any status must now be a no-op.
  it('stops writing after a live issue is marked sent (no 2Hz thrash)', () => {
    const store = createIssueStore()
    const live = mk('a', 'Missing meta description')
    store.sync([live])
    store.markSent('a')
    expect(store.getSent()).toHaveLength(1)

    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    let notifies = 0
    store.subscribe(() => { notifies++ })

    // The issue stays live across many engine ticks.
    for (let i = 0; i < 20; i++) store.sync([live])

    expect(setItem).not.toHaveBeenCalled()
    expect(notifies).toBe(0)
    // ...and it is still tracked as sent, not resurrected as new.
    expect(store.getSent()).toHaveLength(1)
    expect(store.getActive()).toHaveLength(0)
  })

  it('rebuilds when a new key appears or a live "new" issue drops out', () => {
    const store = createIssueStore()
    store.sync([mk('a', 'Missing meta description')])

    const setItem = vi.spyOn(Storage.prototype, 'setItem')

    // (a) a new key appears
    store.sync([mk('a', 'Missing meta description'), mk('b', 'No canonical URL')])
    expect(store.getActive()).toHaveLength(2)

    // (b) a live "new" issue disappears — it should be pruned
    store.sync([mk('a', 'Missing meta description')])
    expect(store.getActive()).toHaveLength(1)

    expect(setItem).toHaveBeenCalledTimes(2)
  })

  it('isolates local fallback issue state by project', () => {
    const projectA = createIssueStore('project-a')
    projectA.sync([mk('a', 'Missing meta description')])
    const projectB = createIssueStore('project-b')

    expect(projectB.getState().issues).toEqual([])
    expect(createIssueStore('project-a').getActive()).toHaveLength(1)
    expect(localStorage.getItem('vibe-check:issues:project-a')).not.toBeNull()
    expect(localStorage.getItem('vibe-check:issues:project-b')).toBeNull()
  })
})
