import type { ProjectWorkflow, TrackedProjectIssue } from '@wcgw/vibe-check-core'

const MAX_HIDDEN_FIXED = 200

export const workflowCacheKey = (projectId: string): string =>
  `vibe-check:workflow:${encodeURIComponent(projectId)}`

const hiddenFixedKey = (projectId: string): string =>
  `vibe-check:workflow-hidden:${encodeURIComponent(projectId)}`

export const isProjectWorkflow = (value: unknown): value is ProjectWorkflow => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ProjectWorkflow>
  return candidate.schemaVersion === 1
    && typeof candidate.projectId === 'string'
    && typeof candidate.revision === 'number'
    && (candidate.impactResetAt === null || typeof candidate.impactResetAt === 'number')
    && Array.isArray(candidate.impactReceipts)
    && Array.isArray(candidate.issues)
}

export const readWorkflowCache = (projectId: string): ProjectWorkflow | null => {
  try {
    if (typeof localStorage === 'undefined' || projectId.length === 0) return null
    const raw = localStorage.getItem(workflowCacheKey(projectId))
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isProjectWorkflow(parsed) && parsed.projectId === projectId ? parsed : null
  } catch {
    return null
  }
}

export const writeWorkflowCache = (projectId: string, workflow: ProjectWorkflow): void => {
  try {
    if (typeof localStorage === 'undefined' || workflow.projectId !== projectId) return
    localStorage.setItem(workflowCacheKey(projectId), JSON.stringify(workflow))
  } catch {
    // Storage unavailable; the online workflow remains authoritative.
  }
}

export const readHiddenFixedKeys = (projectId: string): readonly string[] => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(hiddenFixedKey(projectId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(-MAX_HIDDEN_FIXED)
      : []
  } catch {
    return []
  }
}

const writeHiddenFixedKeys = (projectId: string, issueKeys: readonly string[]): void => {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(hiddenFixedKey(projectId), JSON.stringify(issueKeys.slice(-MAX_HIDDEN_FIXED)))
  } catch {
    // Storage unavailable.
  }
}

export const visibleWorkflowIssues = (
  workflow: ProjectWorkflow | null,
  hiddenFixed: readonly string[],
): readonly TrackedProjectIssue[] => {
  if (!workflow) return []
  const hidden = new Set(hiddenFixed)
  return workflow.issues.filter((tracked) =>
    tracked.phase !== 'fixed' || !hidden.has(tracked.issueKey))
}

export interface WorkflowCache {
  read(): ProjectWorkflow | null
  write(workflow: ProjectWorkflow): void
  hideFixed(issueKeys: readonly string[]): void
  visibleIssues(): readonly TrackedProjectIssue[]
}

export const createWorkflowCache = (projectId: string): WorkflowCache => ({
  read: () => readWorkflowCache(projectId),
  write: (workflow) => writeWorkflowCache(projectId, workflow),
  hideFixed: (issueKeys) => {
    const next = [...new Set([...readHiddenFixedKeys(projectId), ...issueKeys])]
    writeHiddenFixedKeys(projectId, next)
  },
  visibleIssues: () => visibleWorkflowIssues(
    readWorkflowCache(projectId),
    readHiddenFixedKeys(projectId),
  ),
})
