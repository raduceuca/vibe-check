import { useCallback, useEffect, useState } from 'react'
import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'
import {
  isProjectImpactSummary,
  readImpactCache,
  writeImpactCache,
} from '../store/impactCache.js'

interface UseProjectImpactOptions {
  readonly beaconUrl?: string
  readonly projectId?: string
}

const POLL_INTERVAL_MS = 2_000

export const useProjectImpact = ({ beaconUrl, projectId }: UseProjectImpactOptions) => {
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

  useEffect(() => {
    if (!baseUrl || !projectId) return
    let active = true
    const refreshWhileActive = async (): Promise<void> => {
      if (!active) return
      try {
        await refresh()
      } catch {
        // Keep the last persisted summary readable while the local hub is offline.
      }
    }
    void refreshWhileActive()
    const timer = setInterval(() => { void refreshWhileActive() }, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [baseUrl, projectId, refresh])

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
