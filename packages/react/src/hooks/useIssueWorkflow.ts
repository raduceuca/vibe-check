import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectWorkflow } from '@wcgw/vibe-check-core'
import {
  createWorkflowCache,
  isProjectWorkflow,
  readHiddenFixedKeys,
  readWorkflowCache,
  visibleWorkflowIssues,
  writeWorkflowCache,
} from '../store/workflowCache.js'
import { usePolling } from './usePolling.js'

interface UseIssueWorkflowOptions {
  readonly beaconUrl?: string
  readonly projectId?: string
  /**
   * Stop polling, for example while the beacon already knows the hub is down.
   * The cached workflow stays readable and is marked stale.
   */
  readonly paused?: boolean
}

const readErrorCode = async (response: Response): Promise<string | null> => {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'code' in body) {
      const { code } = body as { readonly code: unknown }
      return typeof code === 'string' ? code : null
    }
    return null
  } catch {
    return null
  }
}

// Plain-language reason a check request failed, from the hub's IssueActionResult code.
const verificationFailureMessage = (status: number, code: string | null): string => {
  if (code === 'issue-not-found') return "The hub hasn't seen this issue yet. Wait for the next snapshot, then check again."
  if (code === 'project-not-found') return "The hub doesn't know this project yet. Wait for the next snapshot, then check again."
  if (code === 'lease-conflict') return 'Another agent session owns this project.'
  if (code === 'origin-not-allowed') return 'The hub refused this page. Restart it with --allow-origin for this address.'
  return `The hub could not start the check (HTTP ${status}).`
}

export const useIssueWorkflow = ({ beaconUrl, projectId, paused = false }: UseIssueWorkflowOptions) => {
  const [workflow, setWorkflow] = useState<ProjectWorkflow | null>(
    () => projectId ? readWorkflowCache(projectId) : null,
  )
  const [hiddenFixed, setHiddenFixed] = useState<readonly string[]>(
    () => projectId ? readHiddenFixedKeys(projectId) : [],
  )
  const [stale, setStale] = useState(false)
  const baseUrl = beaconUrl?.replace(/\/$/, '')

  useEffect(() => {
    setWorkflow(projectId ? readWorkflowCache(projectId) : null)
    setHiddenFixed(projectId ? readHiddenFixedKeys(projectId) : [])
    setStale(false)
  }, [projectId])

  // While paused the shown workflow is only the last one we saw.
  useEffect(() => {
    if (paused && baseUrl && projectId) setStale(true)
  }, [paused, baseUrl, projectId])

  const load = useCallback(async (): Promise<boolean> => {
    if (!baseUrl || !projectId) return false
    try {
      const response = await fetch(
        `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/workflow`,
      )
      if (!response.ok) throw new Error(`workflow ${response.status}`)
      const next: unknown = await response.json()
      if (!isProjectWorkflow(next) || next.projectId !== projectId) {
        throw new Error('invalid workflow response')
      }
      writeWorkflowCache(projectId, next)
      setWorkflow(next)
      setStale(false)
      return true
    } catch {
      setStale(true)
      return false
    }
  }, [baseUrl, projectId])

  const refresh = useCallback(async (): Promise<void> => {
    await load()
  }, [load])

  // Polls every 2 s while the hub answers and backs off to 60 s while it does
  // not; nothing runs while the tab is hidden or the caller pauses it.
  usePolling(load, Boolean(baseUrl && projectId) && !paused)

  // Resolves once the hub accepted the request; throws an Error with a
  // plain-language message otherwise (never an unhandled network rejection
  // for callers that await it).
  const requestVerification = useCallback(async (issueId: string): Promise<void> => {
    if (!baseUrl || !projectId) throw new Error('VibeCheck hub is not configured')
    let response: Response
    try {
      response = await fetch(
        `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/verify`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      )
    } catch {
      throw new Error("Couldn't reach the hub. Start it, then check again.")
    }
    if (!response.ok) {
      throw new Error(verificationFailureMessage(response.status, await readErrorCode(response)))
    }
    await load()
  }, [baseUrl, projectId, load])

  const hideFixed = useCallback((issueKeys: readonly string[]): void => {
    if (!projectId) return
    const cache = createWorkflowCache(projectId)
    cache.hideFixed(issueKeys)
    setHiddenFixed(readHiddenFixedKeys(projectId))
  }, [projectId])

  const visibleWorkflow = useMemo<ProjectWorkflow | null>(() => workflow ? {
    ...workflow,
    issues: visibleWorkflowIssues(workflow, hiddenFixed),
  } : null, [hiddenFixed, workflow])

  return {
    workflow: visibleWorkflow,
    stale,
    requestVerification,
    hideFixed,
    refresh,
  }
}
