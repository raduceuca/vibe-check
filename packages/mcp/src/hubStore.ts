import {
  acknowledgeIssue,
  createStore,
  updateSnapshot,
  type VibeStore,
} from './store.js'
import {
  DELIVERY_ACK_TIMEOUT_MS,
  LEASE_EXPIRE_MS,
  WATCH_GRACE_MS,
  formatLeaseConflictMessage,
  getStableIssueKey,
  isDispatchableAgentState,
  normalizePageUrl,
} from '@wcgw/vibe-check-protocol'
import { appendImpactReceipts, deriveProjectImpact } from './impact.js'
import { createImpactReceipts, type ImpactBaseline } from './impactAdapters.js'
import {
  applyWorkflowSnapshot,
  createProjectWorkflow,
  dropUndeliveredDispatches,
  getTrackedVerificationStatus,
  markWorkflowDispatched,
  markWorkflowWorkingByKey,
  mergeRestoredWorkflow,
  requestWorkflowVerificationByKey,
  type VerificationTraces,
} from './workflow.js'
import type {
  AgentConnectionState,
  DeliveryReceiptResult,
  DispatchIssueResponse,
  IssueActionCode,
  IssueActionResult,
  IssueVerificationStatus,
  LeaseHolder,
  LeaseResult,
  ProjectSnapshotEnvelope,
  ProjectStatus,
  ProjectSummary,
  ProjectWorkflow,
  ProjectImpactSummary,
  QueuedIssue,
  Severity,
  DetectorName,
  TrackedProjectIssue,
  VibeIssue,
} from './types.js'

export { LEASE_EXPIRE_MS }
export const PROJECT_ACTIVE_MS = 10_000
export const LEASE_HEARTBEAT_MS = 5_000
export const LEASE_STALE_MS = 10_000
export const CONFLICT_VISIBLE_MS = 30_000
/** Queued plus in-flight dispatches per project. */
export const MAX_DISPATCH_QUEUE = 10
/** Projects held in memory at once (MCP-03). */
export const MAX_HUB_PROJECTS = 100
/** An unregistered, unclaimed, empty project idle this long may be evicted at the cap. */
export const PROJECT_EVICT_IDLE_MS = 60 * 60_000
/** Browser instances not heard from this long are forgotten. */
export const INSTANCE_PRUNE_MS = 5 * 60_000

interface AgentLease {
  readonly sessionId: string
  readonly clientName: string | null
  readonly acquiredAt: number
  readonly heartbeatAt: number
  /** The owner received a dispatch and has not polled again. */
  readonly busy: boolean
  /** When the owner's last watch_for_issue poll ended without a dispatch. */
  readonly watchEndedAt: number | null
}

interface BrowserInstance {
  readonly instanceId: string
  readonly origin: string
  readonly title: string
  readonly lastSeenAt: number
}

/** A dispatch handed to a watcher whose bridge has not confirmed receipt yet. */
export interface InFlightDelivery {
  readonly item: QueuedIssue
  readonly sessionId: string
  readonly deadline: number
}

export interface HubProject {
  readonly projectId: string
  readonly createdAt: number
  readonly instances: ReadonlyMap<string, BrowserInstance>
  readonly store: VibeStore
  /** Page the latest snapshot came from (resolves ids found only in that snapshot). */
  readonly latestPageUrl: string | null
  readonly workflow: ProjectWorkflow
  readonly verification: VerificationTraces
  readonly impactBaselines: ReadonlyMap<string, ImpactBaseline>
  readonly queue: readonly QueuedIssue[]
  readonly inFlight: readonly InFlightDelivery[]
  readonly lease: AgentLease | null
  readonly conflictAt: number | null
}

export interface HubStore {
  readonly projects: ReadonlyMap<string, HubProject>
  readonly sessionProjects: ReadonlyMap<string, string>
}

interface StoreResult<T> {
  readonly store: HubStore
  readonly result: T
}

/**
 * Whether `sessionId` has a watch_for_issue long-poll open on `projectId`.
 * The hub server owns the open requests and answers this; the store stays pure.
 */
export type WaitingLookup = (projectId: string, sessionId: string) => boolean

const notWaiting: WaitingLookup = () => false

export const createHubStore = (): HubStore => ({
  projects: new Map(),
  sessionProjects: new Map(),
})

const replaceProject = (store: HubStore, project: HubProject): HubStore => ({
  ...store,
  projects: new Map(store.projects).set(project.projectId, project),
})

const createProject = (
  projectId: string,
  workflow: ProjectWorkflow,
  queue: readonly QueuedIssue[],
  now: number,
): HubProject => ({
  projectId,
  createdAt: now,
  instances: new Map(),
  store: createStore(),
  latestPageUrl: null,
  workflow,
  verification: new Map(),
  impactBaselines: new Map(),
  queue,
  inFlight: [],
  lease: null,
  conflictAt: null,
})

const latestInstance = (project: HubProject): BrowserInstance | null => {
  let latest: BrowserInstance | null = null
  for (const instance of project.instances.values()) {
    if (latest === null || instance.lastSeenAt > latest.lastSeenAt) latest = instance
  }
  return latest
}

const lastActivityAt = (project: HubProject): number =>
  latestInstance(project)?.lastSeenAt ?? project.createdAt

const isLive = (lease: AgentLease | null, now: number): lease is AgentLease =>
  lease !== null && now - lease.heartbeatAt < LEASE_EXPIRE_MS

const leaseState = (
  lease: AgentLease | null,
  now: number,
  waiting: boolean,
): AgentConnectionState => {
  if (!isLive(lease, now)) return 'no-agent'
  if (now - lease.heartbeatAt >= LEASE_STALE_MS) return 'stale'
  if (waiting) return 'watching'
  if (lease.busy) return 'busy'
  if (lease.watchEndedAt !== null && now - lease.watchEndedAt < WATCH_GRACE_MS) return 'watching'
  return 'leased'
}

const projectState = (project: HubProject, now: number, waiting: WaitingLookup): AgentConnectionState =>
  leaseState(
    project.lease,
    now,
    project.lease !== null && waiting(project.projectId, project.lease.sessionId),
  )

const leaseHolder = (
  project: HubProject,
  now: number,
  waiting: WaitingLookup,
): LeaseHolder | null => {
  const lease = project.lease
  if (!isLive(lease, now)) return null
  return {
    clientName: lease.clientName,
    acquiredAt: lease.acquiredAt,
    heartbeatAt: lease.heartbeatAt,
    expiresAt: lease.heartbeatAt + LEASE_EXPIRE_MS,
    state: projectState(project, now, waiting),
  }
}

// In-flight deliveries go back to the FRONT of the queue (they were dispatched
// first), in their original order.
const requeueDeliveries = (
  project: HubProject,
  shouldRequeue: (delivery: InFlightDelivery) => boolean,
): HubProject => {
  const returning = project.inFlight.filter(shouldRequeue)
  if (returning.length === 0) return project
  return {
    ...project,
    queue: [...returning.map((delivery) => delivery.item), ...project.queue],
    inFlight: project.inFlight.filter((delivery) => !shouldRequeue(delivery)),
  }
}

const releaseExpiredLeases = (store: HubStore, now: number): HubStore => {
  let projects: Map<string, HubProject> | null = null
  let sessionProjects: Map<string, string> | null = null

  for (const project of store.projects.values()) {
    const lease = project.lease
    // Compare the expiry directly: `!isLive(lease)` after `lease !== null` would
    // narrow `lease` to `never` because `isLive` is a type predicate for AgentLease.
    if (lease !== null && now - lease.heartbeatAt >= LEASE_EXPIRE_MS) {
      projects ??= new Map(store.projects)
      sessionProjects ??= new Map(store.sessionProjects)
      projects.set(project.projectId, {
        ...requeueDeliveries(project, (delivery) => delivery.sessionId === lease.sessionId),
        lease: null,
      })
      sessionProjects.delete(lease.sessionId)
    }
  }

  return projects === null
    ? store
    : { projects, sessionProjects: sessionProjects! }
}

/** Moves deliveries whose receipt deadline passed back to the front of the queue. */
export const requeueExpiredDeliveries = (
  store: HubStore,
  projectId: string,
  now: number,
): HubStore => {
  const project = store.projects.get(projectId)
  if (!project) return store
  const next = requeueDeliveries(project, (delivery) => delivery.deadline <= now)
  return next === project ? store : replaceProject(store, next)
}

/** requeueExpiredDeliveries for every project; also returns which projects changed. */
export const requeueAllExpiredDeliveries = (
  store: HubStore,
  now: number,
): { readonly store: HubStore; readonly projectIds: readonly string[] } => {
  let next = store
  const projectIds: string[] = []
  for (const project of store.projects.values()) {
    if (!project.inFlight.some((delivery) => delivery.deadline <= now)) continue
    next = requeueExpiredDeliveries(next, project.projectId, now)
    projectIds.push(project.projectId)
  }
  return { store: next, projectIds }
}

// ── Snapshots and persistence ───────────────────────────────────────────────

export const recordSnapshot = (
  store: HubStore,
  envelope: ProjectSnapshotEnvelope,
  now: number,
  restoredWorkflow?: ProjectWorkflow,
): HubStore => {
  const current = store.projects.get(envelope.projectId)
    ?? createProject(
      envelope.projectId,
      restoredWorkflow ?? createProjectWorkflow(envelope.projectId),
      [],
      now,
    )
  const instances = new Map<string, BrowserInstance>()
  for (const instance of current.instances.values()) {
    if (now - instance.lastSeenAt < INSTANCE_PRUNE_MS) instances.set(instance.instanceId, instance)
  }
  instances.set(envelope.instanceId, {
    instanceId: envelope.instanceId,
    origin: envelope.origin,
    title: envelope.title,
    lastSeenAt: now,
  })

  const previousWorkflow = current.workflow
  const applied = applyWorkflowSnapshot(previousWorkflow, envelope, now, current.verification)
  const recordedWorkflow = applied.workflow
  const previousByKey = new Map(previousWorkflow.issues.map((tracked) => [tracked.issueKey, tracked]))
  const newlyFixed = applied.changed
    ? recordedWorkflow.issues.filter((tracked) =>
      tracked.phase === 'fixed' && previousByKey.get(tracked.issueKey)?.phase === 'verifying')
    : []
  const verifyingIssueKeys = newlyFixed.map((tracked) => tracked.issueKey)
  const impactBaselines = new Map(current.impactBaselines)
  const impactReceipts = newlyFixed.flatMap((tracked) => {
    const baseline = impactBaselines.get(tracked.issueKey)
    return baseline ? createImpactReceipts({
      tracked,
      baseline,
      verification: envelope,
      verifyingIssueKeys,
      confidence: applied.traces.get(tracked.issueKey)?.confidence ?? 'measured',
    }) : []
  })
  for (const tracked of newlyFixed) impactBaselines.delete(tracked.issueKey)
  const workflow = impactReceipts.length > 0 ? {
    ...recordedWorkflow,
    impactReceipts: appendImpactReceipts(recordedWorkflow.impactReceipts, impactReceipts),
  } : recordedWorkflow

  const project: HubProject = {
    ...current,
    instances,
    store: updateSnapshot(current.store, envelope.snapshot),
    latestPageUrl: envelope.pageUrl,
    workflow,
    verification: applied.traces,
    impactBaselines: newlyFixed.length > 0 ? impactBaselines : current.impactBaselines,
  }
  return replaceProject(store, project)
}

/**
 * Brings a project's persisted workflow and queue into the hub: as a new
 * in-memory project, or merged into one the hub was already tracking before it
 * learned the project's root. 'sent' issues whose dispatch was not restored go
 * back to 'detected' with a 'dispatch-dropped' event.
 */
export const restoreProject = (
  store: HubStore,
  projectId: string,
  restored: { readonly workflow: ProjectWorkflow; readonly queue: readonly QueuedIssue[] },
  now: number,
): HubStore => {
  const current = store.projects.get(projectId)
  const queuedKeys = new Set([
    ...restored.queue.map((item) => item.issueKey),
    ...(current?.queue ?? []).map((item) => item.issueKey),
    ...(current?.inFlight ?? []).map((delivery) => delivery.item.issueKey),
  ])
  const restoredWorkflow = dropUndeliveredDispatches(restored.workflow, queuedKeys, now)
  if (!current) {
    return replaceProject(store, createProject(projectId, restoredWorkflow, restored.queue, now))
  }
  const liveKeys = new Set([
    ...current.queue.map((item) => item.issueKey),
    ...current.inFlight.map((delivery) => delivery.item.issueKey),
  ])
  const extra = restored.queue.filter((item) => !liveKeys.has(item.issueKey))
  const room = Math.max(0, MAX_DISPATCH_QUEUE - current.queue.length - current.inFlight.length)
  return replaceProject(store, {
    ...current,
    workflow: mergeRestoredWorkflow(current.workflow, restoredWorkflow),
    queue: [...current.queue, ...extra.slice(0, room)],
  })
}

/** What the hub persists for a project: workflow plus undelivered dispatches (in-flight first). */
export const getPersistableProject = (
  store: HubStore,
  projectId: string,
): { readonly workflow: ProjectWorkflow; readonly queue: readonly QueuedIssue[] } | null => {
  const project = store.projects.get(projectId)
  return project
    ? { workflow: project.workflow, queue: [...project.inFlight.map((delivery) => delivery.item), ...project.queue] }
    : null
}

/**
 * At the project cap, drops the least recently seen projects that are safe to
 * forget: idle at least PROJECT_EVICT_IDLE_MS, not registered (nothing to
 * persist), unclaimed, and with no undelivered dispatch.
 */
export const evictIdleProjects = (
  store: HubStore,
  now: number,
  isRegistered: (projectId: string) => boolean,
  maxProjects: number = MAX_HUB_PROJECTS,
): { readonly store: HubStore; readonly evicted: readonly string[] } => {
  if (store.projects.size < maxProjects) return { store, evicted: [] }
  const candidates = [...store.projects.values()]
    .filter((project) => now - lastActivityAt(project) >= PROJECT_EVICT_IDLE_MS
      && !isRegistered(project.projectId)
      && !isLive(project.lease, now)
      && project.queue.length === 0
      && project.inFlight.length === 0)
    .sort((a, b) => lastActivityAt(a) - lastActivityAt(b))
  const excess = store.projects.size - maxProjects + 1
  const evicted = candidates.slice(0, excess).map((project) => project.projectId)
  if (evicted.length === 0) return { store, evicted }
  const projects = new Map(store.projects)
  for (const projectId of evicted) projects.delete(projectId)
  return { store: { ...store, projects }, evicted }
}

// ── Project listings and status ─────────────────────────────────────────────

const summarize = (
  project: HubProject,
  latest: BrowserInstance,
  now: number,
  waiting: WaitingLookup,
): ProjectSummary => {
  let instanceCount = 0
  for (const instance of project.instances.values()) {
    if (now - instance.lastSeenAt < PROJECT_ACTIVE_MS) instanceCount += 1
  }
  return {
    projectId: project.projectId,
    origin: latest.origin,
    title: latest.title,
    instanceCount,
    lastSeenAt: latest.lastSeenAt,
    agentState: projectState(project, now, waiting),
  }
}

export const listActiveProjects = (
  store: HubStore,
  now: number,
  waiting: WaitingLookup = notWaiting,
): readonly ProjectSummary[] => {
  const result: ProjectSummary[] = []
  for (const project of store.projects.values()) {
    const latest = latestInstance(project)
    if (latest === null || now - latest.lastSeenAt >= PROJECT_ACTIVE_MS) continue
    result.push(summarize(project, latest, now, waiting))
  }
  return result.sort((a, b) => a.projectId.localeCompare(b.projectId))
}

/** Every project a browser has reported to this hub, active or idle. */
export const listKnownProjects = (
  store: HubStore,
  now: number,
  waiting: WaitingLookup = notWaiting,
): readonly ProjectSummary[] => {
  const result: ProjectSummary[] = []
  for (const project of store.projects.values()) {
    const latest = latestInstance(project)
    if (latest !== null) result.push(summarize(project, latest, now, waiting))
  }
  return result.sort((a, b) => a.projectId.localeCompare(b.projectId))
}

export const getProjectStatus = (
  store: HubStore,
  projectId: string,
  now: number,
  waiting: WaitingLookup = notWaiting,
): ProjectStatus | null => {
  const project = store.projects.get(projectId)
  if (!project) return null
  const state = projectState(project, now, waiting)
  const holder = leaseHolder(project, now, waiting)
  return {
    projectId,
    state,
    queueDepth: project.queue.length,
    leaseExpiresAt: holder === null ? null : holder.expiresAt,
    conflictAt: project.conflictAt !== null && now - project.conflictAt < CONFLICT_VISIBLE_MS
      ? project.conflictAt
      : null,
    waiting: project.lease !== null && state !== 'no-agent' && state !== 'stale'
      && waiting(projectId, project.lease.sessionId),
    inFlightDepth: project.inFlight.length,
    holder,
  }
}

// ── Leases ──────────────────────────────────────────────────────────────────

const conflictResult = (
  project: HubProject,
  now: number,
  waiting: WaitingLookup,
): LeaseResult => {
  const holder = leaseHolder(project, now, waiting)
  return {
    ok: false,
    code: 'lease-conflict',
    projectId: project.projectId,
    ...(holder === null ? {} : { holder }),
    message: formatLeaseConflictMessage(project.projectId, holder, now),
  }
}

export const acquireLease = (
  input: HubStore,
  projectId: string,
  sessionId: string,
  now: number,
  clientName?: string,
  waiting: WaitingLookup = notWaiting,
): StoreResult<LeaseResult> => {
  const store = releaseExpiredLeases(input, now)
  const ownedProjectId = store.sessionProjects.get(sessionId)
  if (ownedProjectId && ownedProjectId !== projectId) {
    return {
      store,
      result: {
        ok: false,
        code: 'session-already-watching',
        projectId: ownedProjectId,
        message: `This agent session already watches project "${ownedProjectId}". Call release_project before switching projects.`,
      },
    }
  }

  const project = store.projects.get(projectId)
  if (!project) {
    return {
      store,
      result: {
        ok: false,
        code: 'project-not-found',
        projectId,
        message: `No browser has reported project "${projectId}" to this hub. Open the app with the widget enabled, then call list_projects.`,
      },
    }
  }

  if (project.lease && project.lease.sessionId !== sessionId) {
    const conflicted = { ...project, conflictAt: now }
    return {
      store: replaceProject(store, conflicted),
      result: conflictResult(conflicted, now, waiting),
    }
  }

  const lease: AgentLease = project.lease
    ? { ...project.lease, heartbeatAt: now, clientName: clientName ?? project.lease.clientName }
    : {
      sessionId,
      clientName: clientName ?? null,
      acquiredAt: now,
      heartbeatAt: now,
      busy: false,
      watchEndedAt: null,
    }
  const claimed = replaceProject(store, { ...project, lease })
  return {
    store: {
      ...claimed,
      sessionProjects: new Map(claimed.sessionProjects).set(sessionId, projectId),
    },
    result: { ok: true, projectId, expiresAt: now + LEASE_EXPIRE_MS },
  }
}

export const heartbeatLease = (
  input: HubStore,
  projectId: string,
  sessionId: string,
  now: number,
  waiting: WaitingLookup = notWaiting,
): StoreResult<LeaseResult> => {
  const store = releaseExpiredLeases(input, now)
  const project = store.projects.get(projectId)
  if (!project) {
    return { store, result: { ok: false, code: 'project-not-found', projectId } }
  }
  if (!project.lease || project.lease.sessionId !== sessionId) {
    return { store, result: conflictResult(project, now, waiting) }
  }
  const next = replaceProject(store, {
    ...project,
    lease: { ...project.lease, heartbeatAt: now },
  })
  return {
    store: next,
    result: { ok: true, projectId, expiresAt: now + LEASE_EXPIRE_MS },
  }
}

/**
 * Drops the session's claim. The queue is kept for the next owner, and this
 * session's undelivered hand-offs return to the front of it.
 */
export const releaseLease = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): HubStore => {
  const project = store.projects.get(projectId)
  if (!project?.lease || project.lease.sessionId !== sessionId) return store
  const released = replaceProject(store, {
    ...requeueDeliveries(project, (delivery) => delivery.sessionId === sessionId),
    lease: null,
  })
  const sessionProjects = new Map(released.sessionProjects)
  sessionProjects.delete(sessionId)
  return { ...released, sessionProjects }
}

const updateLease = (
  store: HubStore,
  projectId: string,
  sessionId: string,
  update: (lease: AgentLease) => AgentLease,
): HubStore => {
  const project = store.projects.get(projectId)
  if (!project?.lease || project.lease.sessionId !== sessionId) return store
  return replaceProject(store, { ...project, lease: update(project.lease) })
}

/** The owner opened a watch_for_issue poll: it is no longer busy with a previous dispatch. */
export const markWatchStarted = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): HubStore => updateLease(store, projectId, sessionId, (lease) =>
  ({ ...lease, busy: false, watchEndedAt: null }))

/** The owner's poll ended without a dispatch: 'watching' lasts WATCH_GRACE_MS more, then 'leased'. */
export const markWatchEnded = (
  store: HubStore,
  projectId: string,
  sessionId: string,
  now: number,
): HubStore => updateLease(store, projectId, sessionId, (lease) =>
  ({ ...lease, busy: false, watchEndedAt: now }))

export const markLeaseBusy = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): HubStore => updateLease(store, projectId, sessionId, (lease) =>
  ({ ...lease, busy: true, watchEndedAt: null }))

// ── Dispatch and two-phase delivery ─────────────────────────────────────────

interface LocatedIssue {
  readonly issueKey: string
  readonly issue: VibeIssue
  readonly pageUrl: string
}

// Dispatch queues the hub's own copy of an issue it has seen from the page,
// never the request body: a page cannot put words in the agent's context.
const locateDispatchIssue = (
  project: HubProject,
  pageUrl: string,
  issue: VibeIssue,
): LocatedIssue | null => {
  const issueKey = getStableIssueKey(project.projectId, pageUrl, issue)
  const tracked = project.workflow.issues.find((item) => item.occurrenceIds.includes(issue.id))
    ?? project.workflow.issues.find((item) => item.issueKey === issueKey)
  if (tracked) return { issueKey: tracked.issueKey, issue: tracked.issue, pageUrl: tracked.pageUrl }
  const latest = project.store.latestSnapshot?.issues.find((item) => item.id === issue.id)
  if (!latest) return null
  const latestPageUrl = normalizePageUrl(project.latestPageUrl ?? pageUrl)
  return {
    issueKey: getStableIssueKey(project.projectId, latestPageUrl, latest),
    issue: latest,
    pageUrl: latestPageUrl,
  }
}

export const dispatchIssue = (
  store: HubStore,
  projectId: string,
  pageUrl: string,
  issue: VibeIssue,
  now: number,
  deliveryId: string,
): StoreResult<DispatchIssueResponse> => {
  const project = store.projects.get(projectId)
  const state = project ? projectState(project, now, notWaiting) : 'no-agent'
  if (!project || !isDispatchableAgentState(state)) {
    return {
      store,
      result: { ok: false, code: 'agent-not-watching', projectId, queueDepth: project?.queue.length ?? 0 },
    }
  }
  const latestSnapshot = project.store.latestSnapshot
  const located = latestSnapshot ? locateDispatchIssue(project, pageUrl, issue) : null
  if (!latestSnapshot || !located) {
    return {
      store,
      result: { ok: false, code: 'invalid-issue', projectId, queueDepth: project.queue.length },
    }
  }

  // Sending the same issue again while it waits is idempotent.
  const inFlight = project.inFlight.find((delivery) => delivery.item.issueKey === located.issueKey)
  const queued = project.queue.find((item) => item.issueKey === located.issueKey)
  const existingId = inFlight?.item.deliveryId ?? queued?.deliveryId
  if (existingId !== undefined) {
    return {
      store,
      result: {
        ok: true,
        code: inFlight ? 'dispatched' : 'queued',
        projectId,
        queueDepth: project.queue.length,
        deliveryId: existingId,
      },
    }
  }

  if (project.queue.length + project.inFlight.length >= MAX_DISPATCH_QUEUE) {
    return {
      store,
      result: { ok: false, code: 'queue-full', projectId, queueDepth: project.queue.length },
    }
  }

  const item: QueuedIssue = {
    projectId,
    issueKey: located.issueKey,
    issue: located.issue,
    snapshot: latestSnapshot,
    dispatchedAt: now,
    deliveryId,
    attempts: 0,
  }
  const queue = [...project.queue, item]
  const workflow = markWorkflowDispatched(project.workflow, item.issueKey, now)
  const impactBaselines = new Map(project.impactBaselines).set(
    item.issueKey,
    { pageUrl: located.pageUrl, snapshot: latestSnapshot },
  )
  return {
    store: replaceProject(store, { ...project, queue, workflow, impactBaselines }),
    result: { ok: true, code: 'queued', projectId, queueDepth: queue.length, deliveryId },
  }
}

/**
 * Hands the next queued dispatch to the owner's waiting poll. The item stays
 * in flight (phase still 'sent') until the bridge confirms receipt; without a
 * receipt it returns to the queue after DELIVERY_ACK_TIMEOUT_MS.
 */
export const handOffIssue = (
  store: HubStore,
  projectId: string,
  sessionId: string,
  now: number,
): { readonly store: HubStore; readonly issue: QueuedIssue | null } => {
  const project = store.projects.get(projectId)
  if (!project?.lease || project.lease.sessionId !== sessionId || project.queue.length === 0) {
    return { store, issue: null }
  }
  const [head, ...queue] = project.queue
  if (!head) return { store, issue: null }
  const item: QueuedIssue = { ...head, attempts: (head.attempts ?? 0) + 1 }
  return {
    store: replaceProject(store, {
      ...project,
      queue,
      inFlight: [...project.inFlight, { item, sessionId, deadline: now + DELIVERY_ACK_TIMEOUT_MS }],
      lease: { ...project.lease, busy: true, watchEndedAt: null },
    }),
    issue: item,
  }
}

const receipt = (
  ok: boolean,
  code: DeliveryReceiptResult['code'],
  projectId: string,
  deliveryId: string,
): DeliveryReceiptResult => ({ ok, code, projectId, deliveryId })

/** The bridge returned the dispatch to its agent: phase 'working', lease busy. */
export const confirmDelivery = (
  store: HubStore,
  projectId: string,
  sessionId: string,
  deliveryId: string,
  now: number,
): StoreResult<DeliveryReceiptResult> => {
  const project = store.projects.get(projectId)
  if (!project) return { store, result: receipt(false, 'unknown-delivery', projectId, deliveryId) }
  const flight = project.inFlight.find((delivery) => delivery.item.deliveryId === deliveryId)
  const queued = project.queue.find((item) => item.deliveryId === deliveryId)
  const owner = project.lease?.sessionId === sessionId
  if (flight ? flight.sessionId !== sessionId : queued !== undefined && !owner) {
    return { store, result: receipt(false, 'lease-conflict', projectId, deliveryId) }
  }
  const item = flight?.item ?? queued
  if (!item) return { store, result: receipt(false, 'unknown-delivery', projectId, deliveryId) }
  const delivered = replaceProject(store, {
    ...project,
    inFlight: project.inFlight.filter((delivery) => delivery.item.deliveryId !== deliveryId),
    queue: project.queue.filter((entry) => entry.deliveryId !== deliveryId),
    workflow: markWorkflowWorkingByKey(project.workflow, item.issueKey, now),
  })
  return {
    store: owner ? markLeaseBusy(delivered, projectId, sessionId) : delivered,
    result: receipt(true, 'delivered', projectId, deliveryId),
  }
}

/** The bridge could not hand the dispatch to its agent (call cancelled): back to the front of the queue. */
export const returnDelivery = (
  store: HubStore,
  projectId: string,
  sessionId: string,
  deliveryId: string,
  now: number,
): StoreResult<DeliveryReceiptResult> => {
  const project = store.projects.get(projectId)
  if (!project) return { store, result: receipt(false, 'unknown-delivery', projectId, deliveryId) }
  const flight = project.inFlight.find((delivery) => delivery.item.deliveryId === deliveryId)
  if (!flight) {
    const queued = project.queue.some((item) => item.deliveryId === deliveryId)
    return { store, result: receipt(queued, queued ? 'requeued' : 'unknown-delivery', projectId, deliveryId) }
  }
  if (flight.sessionId !== sessionId) {
    return { store, result: receipt(false, 'lease-conflict', projectId, deliveryId) }
  }
  const requeued = replaceProject(store, requeueDeliveries(project, (delivery) => delivery === flight))
  return {
    store: markWatchEnded(requeued, projectId, sessionId, now),
    result: receipt(true, 'requeued', projectId, deliveryId),
  }
}

// ── Issues and actions ──────────────────────────────────────────────────────

export const getActiveIssues = (
  store: HubStore,
  projectId: string,
  filters: { readonly severity?: Severity; readonly detector?: DetectorName } = {},
): readonly VibeIssue[] => {
  const projectStore = store.projects.get(projectId)?.store
  if (!projectStore?.latestSnapshot) return []
  return projectStore.latestSnapshot.issues.filter((issue) => {
    if (projectStore.acknowledgedIds.has(issue.id) || projectStore.resolvedIds.has(issue.id)) return false
    if (filters.severity && issue.severity !== filters.severity) return false
    if (filters.detector && issue.detector !== filters.detector) return false
    return true
  })
}

export const findProjectIssue = (
  store: HubStore,
  projectId: string,
  issueId: string,
): VibeIssue | undefined => {
  const projectStore = store.projects.get(projectId)?.store
  if (!projectStore) return undefined
  const current = projectStore.latestSnapshot?.issues.find((issue) => issue.id === issueId)
  const historical = current ?? projectStore.issueHistory.find((issue) => issue.id === issueId)
  if (historical) return historical
  return store.projects.get(projectId)?.workflow.issues
    .find((tracked) => tracked.occurrenceIds.includes(issueId))?.issue
}

/**
 * The tracked issue an id refers to: by occurrence id, else by the stable key
 * of the issue the id names (latest snapshot, then history). Ids that rolled
 * out of occurrenceIds still resolve, so an action never silently misses.
 */
const locateTrackedIssue = (
  project: HubProject,
  issueId: string,
): TrackedProjectIssue | null => {
  const direct = project.workflow.issues.find((tracked) => tracked.occurrenceIds.includes(issueId))
  if (direct) return direct
  const latest = project.store.latestSnapshot?.issues.find((issue) => issue.id === issueId)
  const issue = latest ?? project.store.issueHistory.find((item) => item.id === issueId)
  if (!issue) return null
  const candidates = project.workflow.issues.filter((tracked) =>
    tracked.issueKey === getStableIssueKey(project.projectId, tracked.pageUrl, issue))
  if (latest && project.latestPageUrl !== null) {
    const page = normalizePageUrl(project.latestPageUrl)
    const onLatestPage = candidates.find((tracked) => tracked.pageUrl === page)
    if (onLatestPage) return onLatestPage
  }
  return [...candidates].sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0] ?? null
}

const actionResult = (
  ok: boolean,
  code: IssueActionCode,
  projectId: string,
  issueId: string,
  tracked: TrackedProjectIssue | null,
  holder?: LeaseHolder | null,
): IssueActionResult => ({
  ok,
  code,
  projectId,
  issueId,
  issueKey: tracked?.issueKey ?? null,
  phase: tracked?.phase ?? null,
  ...(holder ? { holder } : {}),
})

type ActionTarget =
  | { readonly ok: true; readonly project: HubProject; readonly tracked: TrackedProjectIssue }
  | { readonly ok: false; readonly result: IssueActionResult }

// Only the lease owner may act for agents. A user action from the browser
// (sessionId null) is lease-free.
const actionTarget = (
  store: HubStore,
  projectId: string,
  sessionId: string | null,
  issueId: string,
  now: number,
  waiting: WaitingLookup,
): ActionTarget => {
  const project = store.projects.get(projectId)
  if (!project) {
    return { ok: false, result: actionResult(false, 'project-not-found', projectId, issueId, null) }
  }
  if (sessionId !== null && isLive(project.lease, now) && project.lease.sessionId !== sessionId) {
    return {
      ok: false,
      result: actionResult(false, 'lease-conflict', projectId, issueId, null, leaseHolder(project, now, waiting)),
    }
  }
  const tracked = locateTrackedIssue(project, issueId)
  if (!tracked) {
    return { ok: false, result: actionResult(false, 'issue-not-found', projectId, issueId, null) }
  }
  return { ok: true, project, tracked }
}

const trackedByKey = (workflow: ProjectWorkflow, issueKey: string): TrackedProjectIssue | null =>
  workflow.issues.find((tracked) => tracked.issueKey === issueKey) ?? null

export const acknowledgeProjectIssue = (
  store: HubStore,
  projectId: string,
  sessionId: string | null,
  issueId: string,
  now: number,
  waiting: WaitingLookup = notWaiting,
): StoreResult<IssueActionResult> => {
  const target = actionTarget(store, projectId, sessionId, issueId, now, waiting)
  if (!target.ok) return { store, result: target.result }
  const { project, tracked } = target
  const workflow = markWorkflowWorkingByKey(project.workflow, tracked.issueKey, now)
  return {
    store: replaceProject(store, {
      ...project,
      store: acknowledgeIssue(project.store, issueId),
      workflow,
    }),
    result: actionResult(true, 'acknowledged', projectId, issueId, trackedByKey(workflow, tracked.issueKey)),
  }
}

/**
 * Requests browser-evidence verification for the tracked issue an id names.
 * `sessionId` null is the widget's lease-free "check this fix".
 */
export const resolveProjectIssue = (
  store: HubStore,
  projectId: string,
  sessionId: string | null,
  issueId: string,
  now: number,
  waiting: WaitingLookup = notWaiting,
): StoreResult<IssueActionResult> => {
  const target = actionTarget(store, projectId, sessionId, issueId, now, waiting)
  if (!target.ok) return { store, result: target.result }
  const { project, tracked } = target
  if (tracked.phase === 'verifying' || tracked.phase === 'fixed') {
    return {
      store,
      result: actionResult(
        true,
        tracked.phase === 'fixed' ? 'already-fixed' : 'already-verifying',
        projectId,
        issueId,
        tracked,
      ),
    }
  }
  const workflow = requestWorkflowVerificationByKey(project.workflow, tracked.issueKey, now)
  const verification = new Map(project.verification)
  verification.delete(tracked.issueKey)
  return {
    store: replaceProject(store, { ...project, workflow, verification }),
    result: actionResult(true, 'verifying', projectId, issueId, trackedByKey(workflow, tracked.issueKey)),
  }
}

export const requestProjectVerification = (
  store: HubStore,
  projectId: string,
  issueId: string,
  now: number,
): StoreResult<IssueActionResult> => resolveProjectIssue(store, projectId, null, issueId, now)

export type VerificationLookup =
  | { readonly ok: true; readonly status: IssueVerificationStatus }
  | { readonly ok: false; readonly code: 'project-not-found' | 'issue-not-found' }

export const getVerificationStatus = (
  store: HubStore,
  projectId: string,
  issueId: string,
): VerificationLookup => {
  const project = store.projects.get(projectId)
  if (!project) return { ok: false, code: 'project-not-found' }
  const tracked = locateTrackedIssue(project, issueId)
  if (!tracked) return { ok: false, code: 'issue-not-found' }
  return {
    ok: true,
    status: getTrackedVerificationStatus(projectId, issueId, tracked, project.verification.get(tracked.issueKey)),
  }
}

export const getProjectWorkflow = (
  store: HubStore,
  projectId: string,
): ProjectWorkflow | null => store.projects.get(projectId)?.workflow ?? null

export const getProjectImpact = (
  store: HubStore,
  projectId: string,
): ProjectImpactSummary | null => {
  const workflow = getProjectWorkflow(store, projectId)
  return workflow ? deriveProjectImpact(workflow, workflow.impactReceipts) : null
}

export const resetProjectImpact = (
  store: HubStore,
  projectId: string,
  now: number,
): HubStore => {
  const project = store.projects.get(projectId)
  if (!project) return store
  return replaceProject(store, {
    ...project,
    workflow: {
      ...project.workflow,
      revision: project.workflow.revision + 1,
      impactResetAt: now,
    },
  })
}
