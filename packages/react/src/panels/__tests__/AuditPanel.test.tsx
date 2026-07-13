import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type {
  BeaconStatus,
  DetectorName,
  DispatchIssueResponse,
  VibeIssue,
} from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'
import { AuditPanel } from '../AuditPanel.js'

const connected: BeaconStatus = {
  configured: true,
  projectId: 'project-a',
  instanceId: 'browser-a',
  lastAttemptAt: 1,
  lastOk: true,
  projectStatus: {
    projectId: 'project-a',
    state: 'watching',
    queueDepth: 0,
    leaseExpiresAt: 15_000,
    conflictAt: null,
  },
  statusError: null,
}

const issueFor = (detector: DetectorName): VibeIssue => ({
  id: `${detector}-1`,
  detector,
  severity: 'warning',
  title: detector === 'seo' ? 'Missing or invalid sitemap.xml' : 'Missing answer summary',
  description: 'The page is harder to discover',
  evidence: { check: 'missing', detail: 'No machine-readable discovery document was found.' },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
})

const trackedFor = (detector: DetectorName): TrackedIssue => ({
  issue: issueFor(detector),
  status: 'new',
  firstSeen: 1,
  lastSeen: 1,
  sentAt: null,
  resolvedAt: null,
})

const renderPanel = (detector: 'seo' | 'aeo') => {
  const tracked = trackedFor(detector)
  const onCopy = vi.fn(async () => true)
  const onDispatch = vi.fn(async (): Promise<DispatchIssueResponse> => ({
    ok: true,
    code: 'dispatched',
    projectId: 'project-a',
    queueDepth: 0,
  }))
  const onMarkSent = vi.fn()
  render(<AuditPanel
    tracked={[tracked]}
    detector={detector}
    heading="Audit"
    vibeHeading="Audit"
    subtitle="Audit subtitle"
    vibeSubtitle="Audit subtitle"
    emptyLabel="All clear"
    vibeEmptyLabel="All clear"
    mode="technical"
    copiedId={null}
    onCopy={onCopy}
    beaconStatus={connected}
    onDispatch={onDispatch}
    onMarkSent={onMarkSent}
  />)
  return { tracked, onCopy, onDispatch, onMarkSent }
}

describe('AuditPanel issue actions', () => {
  it.each(['seo', 'aeo'] as const)('shows Send to agent for every %s suggestion', (detector) => {
    const { tracked } = renderPanel(detector)

    fireEvent.click(screen.getByRole('button', { name: new RegExp(tracked.issue.title, 'i') }))

    expect(screen.getByRole('button', { name: /send to agent/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeTruthy()
  })

  it('dispatches the exact audit issue and marks it sent after confirmation', async () => {
    const handlers = renderPanel('seo')
    fireEvent.click(screen.getByRole('button', { name: new RegExp(handlers.tracked.issue.title, 'i') }))

    fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))

    await waitFor(() => expect(handlers.onDispatch).toHaveBeenCalledWith(handlers.tracked.issue))
    expect(handlers.onMarkSent).toHaveBeenCalledWith(handlers.tracked.issue.id)
  })
})
