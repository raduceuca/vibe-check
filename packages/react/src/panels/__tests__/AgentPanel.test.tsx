import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AgentPanel } from '../AgentPanel.js'
import type { BeaconStatus, DispatchIssueResponse, VibeIssue } from '@wcgw/vibe-check-core'
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
})
