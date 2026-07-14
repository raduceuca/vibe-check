import type { ProjectImpactSummary } from '@wcgw/vibe-check-core'

export const impactCacheKey = (projectId: string): string =>
  `vibe-check:impact:${encodeURIComponent(projectId)}`

export const isProjectImpactSummary = (value: unknown): value is ProjectImpactSummary => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ProjectImpactSummary>
  return typeof candidate.projectId === 'string'
    && typeof candidate.detected === 'number'
    && typeof candidate.sent === 'number'
    && typeof candidate.uniqueIssuesFixed === 'number'
    && typeof candidate.verifiedFixes === 'number'
    && typeof candidate.regressionsCaught === 'number'
    && typeof candidate.verificationFailures === 'number'
    && (candidate.medianFixTimeMs === null || typeof candidate.medianFixTimeMs === 'number')
    && Array.isArray(candidate.metrics)
}

export const readImpactCache = (projectId: string): ProjectImpactSummary | null => {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(impactCacheKey(projectId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isProjectImpactSummary(parsed) && parsed.projectId === projectId ? parsed : null
  } catch {
    return null
  }
}

export const writeImpactCache = (projectId: string, impact: ProjectImpactSummary): void => {
  try {
    if (typeof localStorage === 'undefined' || impact.projectId !== projectId) return
    localStorage.setItem(impactCacheKey(projectId), JSON.stringify(impact))
  } catch {
    // The online project ledger remains authoritative when storage is unavailable.
  }
}
