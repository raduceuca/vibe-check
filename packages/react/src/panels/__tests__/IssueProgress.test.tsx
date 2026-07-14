import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { IssueProgress } from '../IssueProgress.js'
import type { TrackedProjectIssue, VibeIssue } from '@wcgw/vibe-check-core'

const issue: VibeIssue = {
  id: 'dom-2',
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM issue',
  description: 'Too many nodes',
  evidence: { nodeCount: 1_600 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
}

const tracked: TrackedProjectIssue = {
  issueKey: 'stable-dom',
  pageUrl: 'http://project-a/pricing',
  issue,
  occurrenceIds: ['dom-1', 'dom-2'],
  phase: 'regressed',
  occurrenceCount: 2,
  regressionCount: 1,
  verificationMisses: 0,
  firstSeenAt: 1,
  lastSeenAt: 8,
  events: [
    { type: 'detected', at: 1, occurrence: 1 },
    { type: 'sent', at: 2, occurrence: 1 },
    { type: 'fixed', at: 6, occurrence: 1 },
    { type: 'regressed', at: 8, occurrence: 2 },
  ],
}

describe('IssueProgress', () => {
  it('shows current regression status and its durable timeline', () => {
    render(<IssueProgress tracked={tracked} mode="technical" />)

    expect(screen.getAllByText('Regressed')).toHaveLength(2)
    expect(screen.getByText(/Occurrence 2/i)).toBeTruthy()
    expect(screen.getByText(/Regressed 1 time/i)).toBeTruthy()
    expect(screen.getByText('Detected')).toBeTruthy()
    expect(screen.getByText('Fixed')).toBeTruthy()
  })
})
