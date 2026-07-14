import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'
import { useProjectImpact } from '../useProjectImpact.js'
import { impactCacheKey } from '../../store/impactCache.js'

const impact: ProjectImpactSummary = {
  projectId: 'project/a',
  detected: 3,
  sent: 2,
  uniqueIssuesFixed: 1,
  verifiedFixes: 1,
  regressionsCaught: 0,
  verificationFailures: 0,
  medianFixTimeMs: 2_000,
  metrics: [],
}

describe('useProjectImpact', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('loads project impact, caches it, and resets through the project endpoint', async () => {
    const resetImpact = { ...impact, detected: 0, sent: 0, uniqueIssuesFixed: 0, verifiedFixes: 0 }
    let reset = false
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') {
        reset = true
        return new Response(JSON.stringify({ reset: true }), { status: 200 })
      }
      return new Response(JSON.stringify(reset ? resetImpact : impact), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result, unmount } = renderHook(() => useProjectImpact({
      beaconUrl: 'http://127.0.0.1:4200/',
      projectId: 'project/a',
    }))
    await waitFor(() => expect(result.current.impact?.detected).toBe(3))
    expect(JSON.parse(localStorage.getItem(impactCacheKey('project/a')) ?? '{}'))
      .toMatchObject({ verifiedFixes: 1 })

    await result.current.resetImpact()
    await waitFor(() => expect(result.current.impact?.verifiedFixes).toBe(0))
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:4200/api/projects/project%2Fa/impact/reset',
      expect.objectContaining({ method: 'POST' }),
    )
    unmount()
  })
})
