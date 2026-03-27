import { describe, it, expect } from 'vitest'
import { createStore, updateSnapshot, acknowledgeIssue, resolveIssue } from '../store.js'
import type { VibeIssue, VibeSnapshot } from '../types.js'

const makeIssue = (overrides: Partial<VibeIssue> = {}): VibeIssue => ({
  id: `issue-${Math.random().toString(36).slice(2, 8)}`,
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'Test Issue',
  description: 'A test issue',
  evidence: { nodeCount: 5000 },
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
  ...overrides,
})

const makeSnapshot = (overrides: Partial<VibeSnapshot> = {}): VibeSnapshot => ({
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.67, maxFrameTime: 20, droppedFrames: 0, smoothness: 1 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 100, jsTransferKB: 50, cssTransferKB: 20, imageTransferKB: 20, fontTransferKB: 10, resourceCount: 5, largeResources: [] },
  issues: [],
  domNodeCount: 500,
  ...overrides,
})

describe('store', () => {
  describe('createStore', () => {
    it('returns an empty store', () => {
      const store = createStore()

      expect(store.latestSnapshot).toBeNull()
      expect(store.issueHistory).toEqual([])
      expect(store.acknowledgedIds.size).toBe(0)
      expect(store.resolvedIds.size).toBe(0)
    })
  })

  describe('updateSnapshot', () => {
    it('updates latestSnapshot', () => {
      const store = createStore()
      const snapshot = makeSnapshot()

      const updated = updateSnapshot(store, snapshot)

      expect(updated.latestSnapshot).toBe(snapshot)
    })

    it('appends issues to issueHistory', () => {
      const store = createStore()
      const issue1 = makeIssue({ id: 'issue-1' })
      const issue2 = makeIssue({ id: 'issue-2' })
      const snapshot1 = makeSnapshot({ issues: [issue1] })
      const snapshot2 = makeSnapshot({ issues: [issue2] })

      const updated1 = updateSnapshot(store, snapshot1)
      const updated2 = updateSnapshot(updated1, snapshot2)

      expect(updated2.issueHistory).toHaveLength(2)
      expect(updated2.issueHistory[0]!.id).toBe('issue-1')
      expect(updated2.issueHistory[1]!.id).toBe('issue-2')
    })

    it('caps issueHistory at 100 entries', () => {
      let store = createStore()

      for (let i = 0; i < 12; i++) {
        const issues = Array.from({ length: 10 }, (_, j) =>
          makeIssue({ id: `issue-${i}-${j}` }),
        )
        store = updateSnapshot(store, makeSnapshot({ issues }))
      }

      expect(store.issueHistory).toHaveLength(100)
      // Should keep the latest 100, discarding the earliest 20
      expect(store.issueHistory[0]!.id).toBe('issue-2-0')
    })

    it('does not mutate the original store', () => {
      const store = createStore()
      const snapshot = makeSnapshot({ issues: [makeIssue()] })

      const updated = updateSnapshot(store, snapshot)

      expect(store.latestSnapshot).toBeNull()
      expect(store.issueHistory).toEqual([])
      expect(updated.latestSnapshot).not.toBeNull()
    })
  })

  describe('acknowledgeIssue', () => {
    it('adds the issue id to acknowledgedIds', () => {
      const store = createStore()

      const updated = acknowledgeIssue(store, 'issue-123')

      expect(updated.acknowledgedIds.has('issue-123')).toBe(true)
    })

    it('preserves existing acknowledged ids', () => {
      const store = createStore()

      const updated1 = acknowledgeIssue(store, 'issue-1')
      const updated2 = acknowledgeIssue(updated1, 'issue-2')

      expect(updated2.acknowledgedIds.has('issue-1')).toBe(true)
      expect(updated2.acknowledgedIds.has('issue-2')).toBe(true)
    })

    it('does not mutate the original store', () => {
      const store = createStore()

      acknowledgeIssue(store, 'issue-1')

      expect(store.acknowledgedIds.size).toBe(0)
    })
  })

  describe('resolveIssue', () => {
    it('adds the issue id to resolvedIds', () => {
      const store = createStore()

      const updated = resolveIssue(store, 'issue-456')

      expect(updated.resolvedIds.has('issue-456')).toBe(true)
    })

    it('preserves existing resolved ids', () => {
      const store = createStore()

      const updated1 = resolveIssue(store, 'issue-1')
      const updated2 = resolveIssue(updated1, 'issue-2')

      expect(updated2.resolvedIds.has('issue-1')).toBe(true)
      expect(updated2.resolvedIds.has('issue-2')).toBe(true)
    })

    it('does not mutate the original store', () => {
      const store = createStore()

      resolveIssue(store, 'issue-1')

      expect(store.resolvedIds.size).toBe(0)
    })
  })
})
