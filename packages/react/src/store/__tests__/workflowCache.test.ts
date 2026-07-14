import { beforeEach, describe, expect, it } from 'vitest'
import {
  createWorkflowCache,
  readWorkflowCache,
  workflowCacheKey,
  writeWorkflowCache,
} from '../workflowCache.js'
import type { ProjectWorkflow, TrackedProjectIssue, VibeIssue } from '@wcgw/vibe-check-core'

const issue = (id: string): VibeIssue => ({
  id,
  detector: 'dom-bloat',
  severity: 'warning',
  title: `Issue ${id}`,
  description: 'Too many nodes',
  evidence: { nodeCount: 1_600 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
})

const tracked = (
  issueKey: string,
  phase: TrackedProjectIssue['phase'],
): TrackedProjectIssue => ({
  issueKey,
  pageUrl: 'http://project-a/pricing',
  issue: issue(issueKey),
  occurrenceIds: [issueKey],
  phase,
  occurrenceCount: phase === 'regressed' ? 2 : 1,
  regressionCount: phase === 'regressed' ? 1 : 0,
  verificationMisses: 0,
  firstSeenAt: 1,
  lastSeenAt: 2,
  events: [{ type: phase === 'regressed' ? 'regressed' : 'fixed', at: 2, occurrence: 1 }],
})

const workflow = (
  projectId: string,
  issueRecord: TrackedProjectIssue,
): ProjectWorkflow => ({ schemaVersion: 1, projectId, revision: 1, issues: [issueRecord] })

describe('workflow cache', () => {
  beforeEach(() => localStorage.clear())

  it('keeps project caches isolated', () => {
    writeWorkflowCache('project-a', workflow('project-a', tracked('a', 'working')))
    writeWorkflowCache('project-b', workflow('project-b', tracked('b', 'fixed')))

    expect(workflowCacheKey('project/a')).toBe('vibe-check:workflow:project%2Fa')
    expect(readWorkflowCache('project-a')?.issues[0]?.phase).toBe('working')
    expect(readWorkflowCache('project-b')?.issues[0]?.phase).toBe('fixed')
  })

  it('hides fixed rows locally without deleting the regression baseline', () => {
    const cache = createWorkflowCache('project-a')
    cache.write(workflow('project-a', tracked('stable-a', 'fixed')))
    cache.hideFixed(['stable-a'])
    expect(cache.visibleIssues()).toEqual([])

    cache.write(workflow('project-a', tracked('stable-a', 'regressed')))
    expect(cache.visibleIssues()).toMatchObject([{
      issueKey: 'stable-a',
      phase: 'regressed',
    }])
    expect(cache.read()?.issues).toHaveLength(1)
  })
})
