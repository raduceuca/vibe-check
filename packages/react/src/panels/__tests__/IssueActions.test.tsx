import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { BeaconStatus, DispatchIssueResponse, VibeIssue } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'
import { DISMISS_TITLE, IssueActions } from '../IssueActions.js'

const issue: VibeIssue = {
  id: 'dom-1',
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM issue',
  description: 'Too many nodes',
  evidence: { nodeCount: 900 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
}

const tracked: TrackedIssue = {
  issue,
  status: 'new',
  firstSeen: 1,
  lastSeen: 1,
  sentAt: null,
  resolvedAt: null,
}

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

interface RenderOptions {
  readonly trackedIssue?: TrackedIssue
  readonly status?: BeaconStatus | null
  readonly hubConfigured?: boolean
  readonly onDispatch?: (selected: VibeIssue) => Promise<DispatchIssueResponse>
  readonly onRequestVerification?: (issueId: string) => Promise<void>
  readonly onMarkResolved?: (issueId: string) => void
}

const renderActions = ({
  trackedIssue = tracked,
  status = connected,
  hubConfigured,
  onDispatch = vi.fn(async (): Promise<DispatchIssueResponse> => ({
    ok: true,
    code: 'dispatched',
    projectId: 'project-a',
    queueDepth: 0,
  })),
  onRequestVerification,
  onMarkResolved = vi.fn(),
}: RenderOptions = {}) => {
  const onCopy = vi.fn(async () => true)
  const onMarkSent = vi.fn()
  render(<IssueActions
    tracked={trackedIssue}
    mode="technical"
    copiedId={null}
    beaconStatus={status}
    hubConfigured={hubConfigured}
    onCopy={onCopy}
    onDispatch={onDispatch}
    onMarkSent={onMarkSent}
    onMarkResolved={onMarkResolved}
    onRequestVerification={onRequestVerification}
  />)
  return { onCopy, onDispatch, onMarkSent, onMarkResolved, onRequestVerification }
}

describe('IssueActions', () => {
  it('sends the exact issue and marks it sent only after confirmed delivery', async () => {
    const handlers = renderActions()

    fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))

    await waitFor(() => expect(handlers.onDispatch).toHaveBeenCalledWith(issue))
    expect(handlers.onMarkSent).toHaveBeenCalledWith('dom-1')
    expect((screen.getByRole('button', { name: 'Sent' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('sent to agent', { selector: 'span[role="status"]' })).toBeTruthy()
  })

  it('keeps Copy prompt independent from delivery state', async () => {
    const handlers = renderActions()

    fireEvent.click(screen.getByRole('button', { name: /copy prompt/i }))

    await waitFor(() => expect(handlers.onCopy).toHaveBeenCalledWith(expect.any(String), 'dom-1'))
    expect(handlers.onDispatch).not.toHaveBeenCalled()
    expect(handlers.onMarkSent).not.toHaveBeenCalled()
  })

  it('shows structured failures without marking the issue sent', async () => {
    const handlers = renderActions({
      onDispatch: vi.fn(async (): Promise<DispatchIssueResponse> => ({
        ok: false,
        code: 'queue-full',
        projectId: 'project-a',
        queueDepth: 10,
      })),
    })

    fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))

    await waitFor(() => expect(screen.getByText('queue full')).toBeTruthy())
    expect(handlers.onMarkSent).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: /send to agent/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('turns thrown dispatch errors into a retryable failed state', async () => {
    const handlers = renderActions({
      onDispatch: vi.fn(async () => { throw new Error('network down') }),
    })

    fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))

    await waitFor(() => expect(screen.getByText('send failed')).toBeTruthy())
    expect(handlers.onMarkSent).not.toHaveBeenCalled()
    expect((screen.getByRole('button', { name: /send to agent/i }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('recovers to a retryable failed state when dispatch never settles', async () => {
    vi.useFakeTimers()
    try {
      const handlers = renderActions({
        onDispatch: vi.fn(() => new Promise<DispatchIssueResponse>(() => undefined)),
      })

      fireEvent.click(screen.getByRole('button', { name: /send to agent/i }))
      expect(screen.getByRole('button', { name: /sending/i })).toBeTruthy()

      await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })

      expect(screen.getByText('send failed')).toBeTruthy()
      expect(handlers.onMarkSent).not.toHaveBeenCalled()
      expect((screen.getByRole('button', { name: /send to agent/i }) as HTMLButtonElement).disabled).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps Send visible but disabled until an agent watcher is connected', () => {
    renderActions({
      status: {
        ...connected,
        projectStatus: { ...connected.projectStatus!, state: 'no-agent' },
      },
    })

    const send = screen.getByRole('button', { name: /send to agent/i })
    expect((send as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Ask one agent session to watch this project first.')).toBeTruthy()
  })

  it('renders an already-sent issue as disabled Sent', () => {
    renderActions({
      trackedIssue: { ...tracked, status: 'sent-to-agent', sentAt: 2 },
    })

    expect((screen.getByRole('button', { name: 'Sent' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('offers dismiss when no hub is configured', () => {
    const handlers = renderActions({
      status: null,
      hubConfigured: false,
    })

    const dismiss = screen.getByRole('button', { name: /^dismiss$/i })
    expect(dismiss.getAttribute('title')).toBe(DISMISS_TITLE)
    fireEvent.click(dismiss)
    expect(handlers.onMarkResolved).toHaveBeenCalledWith('dom-1')
  })

  it('offers check-this-fix verification when a hub is configured', async () => {
    const onRequestVerification = vi.fn(async () => undefined)
    renderActions({ onRequestVerification })

    fireEvent.click(screen.getByRole('button', { name: /verify fix/i }))
    await waitFor(() => expect(onRequestVerification).toHaveBeenCalledWith('dom-1'))
  })
})
