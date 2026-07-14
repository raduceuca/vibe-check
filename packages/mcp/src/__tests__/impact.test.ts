import { describe, expect, it } from 'vitest'
import type {
  ImpactReceipt,
  ProjectWorkflow,
  TrackedProjectIssue,
  VibeIssue,
} from '../types.js'
import {
  appendImpactReceipts,
  deriveProjectImpact,
  impactReceiptId,
} from '../impact.js'

const issue: VibeIssue = {
  id: 'duplicate-1',
  detector: 'duplicate-requests',
  severity: 'warning',
  title: 'Repeated request',
  description: 'The same URL was fetched repeatedly.',
  evidence: { count: 4, url: '/api/menu', method: 'GET' },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
}

const tracked: TrackedProjectIssue = {
  issueKey: 'stable-duplicate',
  pageUrl: 'http://localhost:3000/menu',
  issue,
  occurrenceIds: [issue.id],
  phase: 'fixed',
  occurrenceCount: 2,
  regressionCount: 1,
  verificationMisses: 2,
  firstSeenAt: 1,
  lastSeenAt: 20,
  events: [
    { type: 'detected', at: 1, occurrence: 1 },
    { type: 'sent', at: 2, occurrence: 1 },
    { type: 'working', at: 3, occurrence: 1 },
    { type: 'verification-requested', at: 4, occurrence: 1 },
    { type: 'fixed', at: 8, occurrence: 1 },
    { type: 'regressed', at: 12, occurrence: 2 },
    { type: 'sent', at: 13, occurrence: 2 },
    { type: 'verification-failed', at: 14, occurrence: 2 },
    { type: 'verification-requested', at: 15, occurrence: 2 },
    { type: 'fixed', at: 20, occurrence: 2 },
  ],
}

const workflow: ProjectWorkflow = {
  schemaVersion: 1,
  projectId: 'project-a',
  revision: 10,
  impactResetAt: null,
  impactReceipts: [],
  issues: [tracked],
}

const receipt: ImpactReceipt = {
  id: impactReceiptId('stable-duplicate', 1, 8, 'duplicate-requests-removed'),
  issueKey: 'stable-duplicate',
  occurrence: 1,
  detector: 'duplicate-requests',
  pageUrl: 'http://localhost:3000/menu',
  baselineSnapshotAt: 1,
  verificationSnapshotAt: 8,
  kind: 'duplicate-requests-removed',
  before: 4,
  after: 1,
  delta: 3,
  unit: 'requests',
  confidence: 'measured',
}

describe('project impact', () => {
  it('derives exact workflow totals and never double-counts a receipt', () => {
    const receipts = appendImpactReceipts([], [receipt, receipt])
    expect(receipts).toEqual([receipt])
    expect(deriveProjectImpact(workflow, receipts)).toEqual({
      projectId: 'project-a',
      detected: 1,
      sent: 2,
      uniqueIssuesFixed: 1,
      verifiedFixes: 2,
      regressionsCaught: 1,
      verificationFailures: 1,
      medianFixTimeMs: 6.5,
      metrics: [{
        kind: 'duplicate-requests-removed',
        value: 3,
        unit: 'requests',
        confidence: 'measured',
        label: 'duplicate requests removed',
        scope: 'per observed page load',
      }],
    })
  })

  it('resets visible totals without deleting the underlying history', () => {
    const resetWorkflow: ProjectWorkflow = { ...workflow, impactResetAt: 12 }
    expect(deriveProjectImpact(resetWorkflow, [receipt])).toMatchObject({
      detected: 0,
      sent: 1,
      uniqueIssuesFixed: 1,
      verifiedFixes: 1,
      regressionsCaught: 0,
      verificationFailures: 1,
      metrics: [],
    })
    expect(resetWorkflow.issues).toEqual(workflow.issues)
  })
})
