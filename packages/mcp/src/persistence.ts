import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { issueSchema } from './schema.js'
import { createProjectWorkflow } from './workflow.js'
import type { ProjectWorkflow } from './types.js'

const workflowEventSchema = z.object({
  type: z.enum([
    'detected',
    'sent',
    'working',
    'verification-requested',
    'verification-failed',
    'fixed',
    'regressed',
  ]),
  at: z.number(),
  occurrence: z.number().int().min(1),
})

const trackedProjectIssueSchema = z.object({
  issueKey: z.string().min(1),
  pageUrl: z.string(),
  issue: issueSchema,
  occurrenceIds: z.array(z.string().min(1)).max(20),
  phase: z.enum(['detected', 'sent', 'working', 'verifying', 'fixed', 'regressed']),
  occurrenceCount: z.number().int().min(1),
  regressionCount: z.number().int().min(0),
  verificationMisses: z.number().int().min(0),
  firstSeenAt: z.number(),
  lastSeenAt: z.number(),
  events: z.array(workflowEventSchema).max(50),
})

const impactReceiptSchema = z.object({
  id: z.string().min(1),
  issueKey: z.string().min(1),
  occurrence: z.number().int().min(1),
  detector: issueSchema.shape.detector,
  pageUrl: z.string(),
  baselineSnapshotAt: z.number(),
  verificationSnapshotAt: z.number(),
  kind: z.enum([
    'duplicate-requests-removed',
    'console-calls-reduced',
    'dom-nodes-reduced',
    'transfer-kb-reduced',
    'blocking-ms-reduced',
  ]),
  before: z.number().finite(),
  after: z.number().finite(),
  delta: z.number().positive(),
  unit: z.enum(['requests', 'calls', 'nodes', 'KB', 'ms']),
  confidence: z.enum(['measured', 'estimated']),
})

const projectWorkflowSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  revision: z.number().int().min(0),
  impactResetAt: z.number().nullable().default(null),
  impactReceipts: z.array(impactReceiptSchema).max(1_000).default([]),
  issues: z.array(trackedProjectIssueSchema).max(200),
})

const persistedProjectStateSchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.record(z.string(), projectWorkflowSchema),
})

interface PersistedProjectState {
  readonly schemaVersion: 1
  readonly projects: Readonly<Record<string, ProjectWorkflow>>
}

const emptyState = (): PersistedProjectState => ({ schemaVersion: 1, projects: {} })

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'

const readState = async (path: string): Promise<PersistedProjectState> => {
  try {
    const parsed = persistedProjectStateSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    return parsed as PersistedProjectState
  } catch (error) {
    if (isMissing(error)) return emptyState()
    throw error
  }
}

const backupCorruptState = async (
  path: string,
  onWarning?: (message: string) => void,
): Promise<void> => {
  const backupPath = `${path}.corrupt-${Date.now()}`
  try {
    await rename(path, backupPath)
  } catch (error) {
    if (!isMissing(error)) throw error
  }
  onWarning?.(`Invalid VibeCheck state was moved to ${backupPath}`)
}

const readRecoveringState = async (
  path: string,
  onWarning?: (message: string) => void,
): Promise<PersistedProjectState> => {
  try {
    return await readState(path)
  } catch {
    await backupCorruptState(path, onWarning)
    return emptyState()
  }
}

export const readPersistedWorkflow = async (
  statePath: string,
  projectId: string,
  onWarning?: (message: string) => void,
): Promise<ProjectWorkflow> => {
  const state = await readRecoveringState(statePath, onWarning)
  return state.projects[projectId] ?? createProjectWorkflow(projectId)
}

const stateWrites = new Map<string, Promise<void>>()

export const writePersistedWorkflow = async (
  statePath: string,
  workflow: ProjectWorkflow,
): Promise<void> => {
  const previous = stateWrites.get(statePath) ?? Promise.resolve()
  const operation = previous.then(async () => {
    await mkdir(dirname(statePath), { recursive: true })
    const current = await readRecoveringState(statePath)
    const next: PersistedProjectState = {
      schemaVersion: 1,
      projects: { ...current.projects, [workflow.projectId]: workflow },
    }
    const temporary = join(
      dirname(statePath),
      `.${basename(statePath)}.${process.pid}.${randomUUID()}.tmp`,
    )
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`)
    await rename(temporary, statePath)
  })
  stateWrites.set(statePath, operation)
  try {
    await operation
  } finally {
    if (stateWrites.get(statePath) === operation) stateWrites.delete(statePath)
  }
}
