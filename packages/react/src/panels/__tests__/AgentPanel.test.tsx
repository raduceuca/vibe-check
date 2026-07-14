import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentPanel } from '../AgentPanel.js'
import type {
  BeaconStatus,
  DispatchIssueResponse,
  ProjectWorkflow,
  TrackedProjectIssue,
  VibeIssue,
} from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'

const issue: VibeIssue = {
  id: 'dom-1', detector: 'dom-bloat', severity: 'warning', title: 'DOM issue',
  description: 'Too many nodes', evidence: { nodeCount: 900 }, timestamp: 1,
  acknowledged: false, resolved: false,
}
const tracked: TrackedIssue = {
  issue, status: 'new', firstSeen: 1, lastSeen: 1, sentAt: null, resolvedAt: null,
}
const connected: BeaconStatus = {
  configured: true, projectId: 'project-a', instanceId: 'browser-a', lastAttemptAt: 1, lastOk: true,
  projectStatus: { projectId: 'project-a', state: 'watching', queueDepth: 0, leaseExpiresAt: 15_000, conflictAt: null },
  statusError: null,
}

const renderPanel = (onDispatch: (issue: VibeIssue) => Promise<DispatchIssueResponse>) => {
  const onCopy = vi.fn(async () => true)
  const onMarkSent = vi.fn()
  render(<AgentPanel
    tracked={[tracked]} mode="technical" copiedId={null} onCopy={onCopy}
    beaconUrl="http://127.0.0.1:4200"
    beaconStatus={connected} onDispatch={onDispatch} onMarkSent={onMarkSent}
    onMarkResolved={vi.fn()} onClearResolved={vi.fn()}
  />)
  fireEvent.click(screen.getByRole('button', { name: /DOM issue/i }))
  return { onCopy, onMarkSent }
}

describe('AgentPanel delivery', () => {
  it('copies without claiming that the issue was sent', async () => {
    const { onCopy, onMarkSent } = renderPanel(vi.fn())
    fireEvent.click(screen.getAllByRole('button', { name: /copy prompt/i }).at(-1)!)
    await waitFor(() => expect(onCopy).toHaveBeenCalled())
    expect(onMarkSent).not.toHaveBeenCalled()
  })

  it('marks sent only after confirmed agent dispatch', async () => {
    const onDispatch = vi.fn(async (): Promise<DispatchIssueResponse> => ({
      ok: true, code: 'dispatched', projectId: 'project-a', queueDepth: 0,
    }))
    const { onMarkSent } = renderPanel(onDispatch)
    fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))
    await waitFor(() => expect(onMarkSent).toHaveBeenCalledWith('dom-1'))
    expect(screen.getByText('sent')).toBeTruthy()
  })

  it('shows a failed delivery without marking sent', async () => {
    const onDispatch = vi.fn(async (): Promise<DispatchIssueResponse> => ({
      ok: false, code: 'queue-full', projectId: 'project-a', queueDepth: 10,
    }))
    const { onMarkSent } = renderPanel(onDispatch)
    fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))
    await waitFor(() => expect(screen.getByText('queue full')).toBeTruthy())
    expect(onMarkSent).not.toHaveBeenCalled()
  })

  it('groups durable phases and keeps regressions actionable', () => {
    const workflowIssue = (
      id: string,
      phase: TrackedProjectIssue['phase'],
    ): TrackedProjectIssue => ({
      issueKey: `stable-${id}`,
      pageUrl: 'http://project-a/pricing',
      issue: { ...issue, id, title: `Issue ${id}` },
      occurrenceIds: [id],
      phase,
      occurrenceCount: phase === 'regressed' ? 2 : 1,
      regressionCount: phase === 'regressed' ? 1 : 0,
      verificationMisses: 0,
      firstSeenAt: 1,
      lastSeenAt: 2,
      events: [{
        type: phase === 'regressed' ? 'regressed' : phase === 'fixed' ? 'fixed' : 'working',
        at: 2,
        occurrence: 1,
      }],
    })
    const workflow: ProjectWorkflow = {
      schemaVersion: 1,
      projectId: 'project-a',
      revision: 4,
      issues: [
        workflowIssue('regressed', 'regressed'),
        workflowIssue('working', 'working'),
        workflowIssue('fixed', 'fixed'),
      ],
    }

    render(<AgentPanel
      tracked={[]} workflow={workflow} workflowStale mode="technical"
      copiedId={null} onCopy={vi.fn(async () => true)}
      beaconUrl="http://127.0.0.1:4200" beaconStatus={connected}
      onDispatch={vi.fn()} onMarkSent={vi.fn()} onMarkResolved={vi.fn()}
      onRequestVerification={vi.fn(async () => undefined)}
      onClearResolved={vi.fn()} onHideFixed={vi.fn()}
    />)

    expect(screen.getByRole('tab', { name: /active \(1\)/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /in progress \(1\)/i })).toBeTruthy()
    expect(screen.getByRole('tab', { name: /resolved \(1\)/i })).toBeTruthy()
    expect(screen.getByText(/last known/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Issue regressed/i }))
    expect(screen.getByText(/Occurrence 2/i)).toBeTruthy()
    expect(screen.getByText(/Regressed 1 time/i)).toBeTruthy()
  })
})
