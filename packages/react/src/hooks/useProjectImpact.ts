import { useCallback, useEffect, useState } from 'react'
import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'
import {
  isProjectImpactSummary,
  readImpactCache,
  writeImpactCache,
} from '../store/impactCache.js'
import { usePolling } from './usePolling.js'

interface UseProjectImpactOptions {
  readonly beaconUrl?: string
  readonly projectId?: string
  /** Stop polling (hub known to be down, or nothing on screen shows impact). */
  readonly paused?: boolean
}

export const useProjectImpact = ({ beaconUrl, projectId, paused = false }: UseProjectImpactOptions) => {
  const [impact, setImpact] = useState<ProjectImpactSummary | null>(
    () => projectId ? readImpactCache(projectId) : null,
  )
  const baseUrl = beaconUrl?.replace(/\/$/, '')

  useEffect(() => {
    setImpact(projectId ? readImpactCache(projectId) : null)
  }, [projectId])

  const refresh = useCallback(async (): Promise<void> => {
    if (!baseUrl || !projectId) return
    const response = await fetch(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/impact`,
    )
    if (!response.ok) throw new Error(`impact ${response.status}`)
    const next: unknown = await response.json()
    if (!isProjectImpactSummary(next) || next.projectId !== projectId) {
      throw new Error('invalid impact response')
    }
    writeImpactCache(projectId, next)
    setImpact(next)
  }, [baseUrl, projectId])

  // Keep the last persisted summary readable while the local hub is offline.
  const load = useCallback(async (): Promise<boolean> => {
    try {
      await refresh()
      return true
    } catch {
      return false
    }
  }, [refresh])

  usePolling(load, Boolean(baseUrl && projectId) && !paused)

  const resetImpact = useCallback(async (): Promise<void> => {
    if (!baseUrl || !projectId) throw new Error('VibeCheck hub is not configured')
    const response = await fetch(
      `${baseUrl}/api/projects/${encodeURIComponent(projectId)}/impact/reset`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
    )
    if (!response.ok) throw new Error(`impact reset ${response.status}`)
    await refresh()
  }, [baseUrl, projectId, refresh])

  return { impact, refresh, resetImpact }
}
