import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BeaconStatus, DispatchIssueResponse, VibeIssue } from '@wcgw/vibe-check-core'
import type { TrackedIssue } from '../../store/issueStore.js'
import { AnnotationOverlay } from '../AnnotationOverlay.js'

const issue: VibeIssue = {
  id: 'image-1',
  detector: 'unoptimized-images',
  severity: 'warning',
  title: 'Large image',
  description: 'Image needs optimization',
  evidence: { selector: '#problem-target', src: '/hero.png', naturalWidth: 2000, naturalHeight: 1200 },
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

afterEach(() => {
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('AnnotationOverlay issue actions', () => {
  it('shows Send, Copy, and Resolve for an annotated issue', async () => {
    const target = document.createElement('div')
    target.id = 'problem-target'
    target.getBoundingClientRect = () => ({
      x: 20,
      y: 20,
      top: 20,
      left: 20,
      right: 120,
      bottom: 80,
      width: 100,
      height: 60,
      toJSON: () => ({}),
    })
    document.body.append(target)
    vi.stubGlobal('IntersectionObserver', undefined)

    render(<AnnotationOverlay
      tracked={[tracked]}
      visible
      mode="technical"
      theme="dark"
      copiedId={null}
      onCopy={vi.fn(async () => true)}
      beaconStatus={connected}
      onDispatch={vi.fn(async (): Promise<DispatchIssueResponse> => ({
        ok: true,
        code: 'dispatched',
        projectId: 'project-a',
        queueDepth: 0,
      }))}
      onMarkSent={vi.fn()}
      onMarkResolved={vi.fn()}
    />)

    const marker = await waitFor(() => screen.getByRole('button', { name: /1 issue: Large image/i }))
    fireEvent.click(marker)

    expect(screen.getByRole('button', { name: /send to agent/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy prompt/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /resolve/i })).toBeTruthy()
  })
})
