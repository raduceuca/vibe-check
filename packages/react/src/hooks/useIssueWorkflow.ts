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

interface UseIssueWorkflowOptions {
  readonly beaconUrl?: string
  readonly projectId?: string
}

const POLL_INTERVAL_MS = 2_000

export const useIssueWorkflow = ({ beaconUrl, projectId }: UseIssueWorkflowOptions) => {
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

  const refresh = useCallback(async (): Promise<void> => {
    if (!baseUrl || !projectId) return
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
    } catch {
      setStale(true)
    }
  }, [baseUrl, projectId])

  useEffect(() => {
    if (!baseUrl || !projectId) return
    let active = true
    const refreshWhileActive = async (): Promise<void> => {
      if (active) await refresh()
    }
    void refreshWhileActive()
    const timer = setInterval(() => { void refreshWhileActive() }, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [baseUrl, projectId, refresh])

  const requestVerification = useCallback(async (issueId: string): Promise<void> => {
    if (!baseUrl || !projectId) throw new Error('VibeCheck hub is not configured')
    const response = await fetch(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/issues/${encodeURIComponent(issueId)}/verify`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    if (!response.ok) throw new Error(`verification ${response.status}`)
    await refresh()
  }, [baseUrl, projectId, refresh])

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
