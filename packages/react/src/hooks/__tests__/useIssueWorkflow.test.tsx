import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useIssueWorkflow } from '../useIssueWorkflow.js'
import { writeWorkflowCache } from '../../store/workflowCache.js'
import type { ProjectWorkflow } from '@wcgw/vibe-check-core'

const cached: ProjectWorkflow = {
  schemaVersion: 1,
  projectId: 'project-a',
  revision: 3,
  impactResetAt: null,
  issues: [],
}

describe('useIssueWorkflow', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('falls back to project cache and labels a failed refresh stale', async () => {
    writeWorkflowCache('project-a', cached)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))

    const { result, unmount } = renderHook(() => useIssueWorkflow({
      beaconUrl: 'http://127.0.0.1:4200',
      projectId: 'project-a',
    }))

    await waitFor(() => expect(result.current.stale).toBe(true))
    expect(result.current.workflow).toEqual(cached)
    unmount()
  })

  it('writes an online workflow and requests verification through the project endpoint', async () => {
    const online = { ...cached, projectId: 'project/a', revision: 4 }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'POST'
        ? new Response(JSON.stringify({ verifying: true }), { status: 200 })
        : new Response(JSON.stringify(online), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result, unmount } = renderHook(() => useIssueWorkflow({
      beaconUrl: 'http://127.0.0.1:4200/',
      projectId: 'project/a',
    }))
    await waitFor(() => expect(result.current.workflow?.revision).toBe(4))
    await result.current.requestVerification('issue-1')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4200/api/projects/project%2Fa/issues/issue-1/verify',
      expect.objectContaining({ method: 'POST' }),
    )
    unmount()
  })
})
