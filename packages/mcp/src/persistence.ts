import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { z } from 'zod'
import { HUB_INTAKE_LIMITS, boundIssue } from '@wcgw/vibe-check-protocol'
import { issueSchema, parseSnapshot } from './schema.js'
import { createProjectWorkflow } from './workflow.js'
import type { ProjectWorkflow, QueuedIssue, TrackedProjectIssue } from './types.js'

const workflowEventSchema = z.object({
  type: z.enum([
    'detected',
    'sent',
    'working',
    'verification-requested',
    'verification-failed',
    'fixed',
    'regressed',
    'dispatch-dropped',
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

// Since 0.4 the hub also keeps each registered project's undelivered
// dispatches here, so a release, a bridge exit or a hub restart does not lose
// them. The field is optional and validated item by item: a bad queue entry is
// dropped, never a reason to treat the workflow history as corrupt. 0.3 hubs
// ignore the field.
const persistedProjectStateSchema = z.object({
  schemaVersion: z.literal(1),
  projects: z.record(z.string(), projectWorkflowSchema),
  dispatchQueues: z.record(z.string(), z.array(z.unknown())).optional().catch(undefined),
})

const queuedIssueSchema = z.object({
  projectId: z.string().min(1),
  issueKey: z.string().min(1),
  issue: issueSchema,
  snapshot: z.unknown(),
  dispatchedAt: z.number(),
  deliveryId: z.string().min(1).optional(),
  attempts: z.number().int().min(0).optional(),
})

interface PersistedProjectState {
  readonly schemaVersion: 1
  readonly projects: Readonly<Record<string, ProjectWorkflow>>
  readonly dispatchQueues?: Readonly<Record<string, readonly unknown[]>>
}

/** One project's durable hub state. */
export interface PersistedProject {
  readonly workflow: ProjectWorkflow
  /** Undelivered dispatches, oldest first (in-flight deliveries are stored as queued). */
  readonly queue: readonly QueuedIssue[]
}

const MAX_PERSISTED_QUEUE = 10

const emptyState = (): PersistedProjectState => ({ schemaVersion: 1, projects: {} })

const isMissing = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'

const hasOwn = (record: object, key: string): boolean => Object.prototype.hasOwnProperty.call(record, key)

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

// State written before 0.4 could hold unbounded evidence; keep what the hub
// would accept today.
const boundTracked = (tracked: TrackedProjectIssue): TrackedProjectIssue => {
  const issue = boundIssue(tracked.issue, HUB_INTAKE_LIMITS)
  return issue === tracked.issue ? tracked : { ...tracked, issue }
}

const boundWorkflow = (workflow: ProjectWorkflow): ProjectWorkflow => {
  const issues = workflow.issues.map(boundTracked)
  return issues.every((tracked, index) => tracked === workflow.issues[index])
    ? workflow
    : { ...workflow, issues }
}

const parseQueue = (projectId: string, items: readonly unknown[]): readonly QueuedIssue[] =>
  items.flatMap((item): QueuedIssue[] => {
    const parsed = queuedIssueSchema.safeParse(item)
    if (!parsed.success || parsed.data.projectId !== projectId) return []
    const snapshot = parseSnapshot(parsed.data.snapshot)
    if (!snapshot) return []
    return [{
      projectId,
      issueKey: parsed.data.issueKey,
      issue: boundIssue(parsed.data.issue, HUB_INTAKE_LIMITS),
      snapshot,
      dispatchedAt: parsed.data.dispatchedAt,
      deliveryId: parsed.data.deliveryId ?? randomUUID(),
      attempts: parsed.data.attempts ?? 0,
    }]
  }).slice(0, MAX_PERSISTED_QUEUE)

/** Reads one project's workflow and dispatch queue; a missing file or project yields an empty state. */
export const readPersistedProject = async (
  statePath: string,
  projectId: string,
  onWarning?: (message: string) => void,
): Promise<PersistedProject> => {
  const state = await readRecoveringState(statePath, onWarning)
  const workflow = hasOwn(state.projects, projectId) ? state.projects[projectId] : undefined
  const queue = state.dispatchQueues && hasOwn(state.dispatchQueues, projectId)
    ? state.dispatchQueues[projectId] ?? []
    : []
  return {
    workflow: workflow ? boundWorkflow(workflow) : createProjectWorkflow(projectId),
    queue: parseQueue(projectId, queue),
  }
}

export const readPersistedWorkflow = async (
  statePath: string,
  projectId: string,
  onWarning?: (message: string) => void,
): Promise<ProjectWorkflow> => (await readPersistedProject(statePath, projectId, onWarning)).workflow

const stateWrites = new Map<string, Promise<void>>()

const writeState = async (
  statePath: string,
  update: (current: PersistedProjectState) => PersistedProjectState,
): Promise<void> => {
  const previous = stateWrites.get(statePath) ?? Promise.resolve()
  const operation = previous.catch(() => undefined).then(async () => {
    await mkdir(dirname(statePath), { recursive: true })
    const next = update(await readRecoveringState(statePath))
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

/** Writes one project's workflow and dispatch queue, leaving other projects in the same file untouched. */
export const writePersistedProject = async (
  statePath: string,
  project: PersistedProject,
): Promise<void> => writeState(statePath, (current) => ({
  schemaVersion: 1,
  projects: { ...current.projects, [project.workflow.projectId]: project.workflow },
  dispatchQueues: {
    ...(current.dispatchQueues ?? {}),
    [project.workflow.projectId]: project.queue.slice(0, MAX_PERSISTED_QUEUE),
  },
}))

/** 0.3 API: writes the workflow and keeps any persisted queue for that project. */
export const writePersistedWorkflow = async (
  statePath: string,
  workflow: ProjectWorkflow,
): Promise<void> => writeState(statePath, (current) => ({
  ...current,
  schemaVersion: 1,
  projects: { ...current.projects, [workflow.projectId]: workflow },
}))
