import {
  acknowledgeIssue,
  createStore,
  resolveIssue,
  updateSnapshot,
  type VibeStore,
} from './store.js'
import { getStableIssueKey } from '@wcgw/vibe-check-protocol'
import type {
  AgentConnectionState,
  DispatchIssueResponse,
  LeaseResult,
  ProjectSnapshotEnvelope,
  ProjectStatus,
  ProjectSummary,
  QueuedIssue,
  Severity,
  DetectorName,
  VibeIssue,
} from './types.js'

export const PROJECT_ACTIVE_MS = 10_000
export const LEASE_HEARTBEAT_MS = 5_000
export const LEASE_STALE_MS = 10_000
export const LEASE_EXPIRE_MS = 15_000
export const CONFLICT_VISIBLE_MS = 30_000
export const MAX_DISPATCH_QUEUE = 10

interface AgentLease {
  readonly sessionId: string
  readonly heartbeatAt: number
  readonly mode: 'watching' | 'busy'
}

interface BrowserInstance {
  readonly instanceId: string
  readonly origin: string
  readonly title: string
  readonly lastSeenAt: number
}

export interface HubProject {
  readonly projectId: string
  readonly instances: ReadonlyMap<string, BrowserInstance>
  readonly store: VibeStore
  readonly queue: readonly QueuedIssue[]
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

export const createHubStore = (): HubStore => ({
  projects: new Map(),
  sessionProjects: new Map(),
})

const replaceProject = (store: HubStore, project: HubProject): HubStore => ({
  ...store,
  projects: new Map(store.projects).set(project.projectId, project),
})

const latestInstance = (project: HubProject): BrowserInstance | null => {
  let latest: BrowserInstance | null = null
  for (const instance of project.instances.values()) {
    if (latest === null || instance.lastSeenAt > latest.lastSeenAt) latest = instance
  }
  return latest
}

const leaseState = (lease: AgentLease | null, now: number): AgentConnectionState => {
  if (lease === null || now - lease.heartbeatAt >= LEASE_EXPIRE_MS) return 'no-agent'
  if (now - lease.heartbeatAt >= LEASE_STALE_MS) return 'stale'
  return lease.mode
}

const releaseExpiredLeases = (store: HubStore, now: number): HubStore => {
  let projects: Map<string, HubProject> | null = null
  let sessionProjects: Map<string, string> | null = null

  for (const project of store.projects.values()) {
    if (project.lease !== null && now - project.lease.heartbeatAt >= LEASE_EXPIRE_MS) {
      projects ??= new Map(store.projects)
      sessionProjects ??= new Map(store.sessionProjects)
      projects.set(project.projectId, { ...project, lease: null })
      sessionProjects.delete(project.lease.sessionId)
    }
  }

  return projects === null
    ? store
    : { projects, sessionProjects: sessionProjects! }
}

export const recordSnapshot = (
  store: HubStore,
  envelope: ProjectSnapshotEnvelope,
  now: number,
): HubStore => {
  const current = store.projects.get(envelope.projectId)
  const instances = new Map(current?.instances ?? [])
  instances.set(envelope.instanceId, {
    instanceId: envelope.instanceId,
    origin: envelope.origin,
    title: envelope.title,
    lastSeenAt: now,
  })

  const project: HubProject = {
    projectId: envelope.projectId,
    instances,
    store: updateSnapshot(current?.store ?? createStore(), envelope.snapshot),
    queue: current?.queue ?? [],
    lease: current?.lease ?? null,
    conflictAt: current?.conflictAt ?? null,
  }
  return replaceProject(store, project)
}

export const listActiveProjects = (store: HubStore, now: number): readonly ProjectSummary[] => {
  const result: ProjectSummary[] = []
  for (const project of store.projects.values()) {
    const latest = latestInstance(project)
    if (latest === null || now - latest.lastSeenAt >= PROJECT_ACTIVE_MS) continue
    let instanceCount = 0
    for (const instance of project.instances.values()) {
      if (now - instance.lastSeenAt < PROJECT_ACTIVE_MS) instanceCount += 1
    }
    result.push({
      projectId: project.projectId,
      origin: latest.origin,
      title: latest.title,
      instanceCount,
      lastSeenAt: latest.lastSeenAt,
      agentState: leaseState(project.lease, now),
    })
  }
  return result.sort((a, b) => a.projectId.localeCompare(b.projectId))
}

export const getProjectStatus = (
  store: HubStore,
  projectId: string,
  now: number,
): ProjectStatus | null => {
  const project = store.projects.get(projectId)
  if (!project) return null
  const state = leaseState(project.lease, now)
  return {
    projectId,
    state,
    queueDepth: project.queue.length,
    leaseExpiresAt: state === 'no-agent' || project.lease === null
      ? null
      : project.lease.heartbeatAt + LEASE_EXPIRE_MS,
    conflictAt: project.conflictAt !== null && now - project.conflictAt < CONFLICT_VISIBLE_MS
      ? project.conflictAt
      : null,
  }
}

export const acquireLease = (
  input: HubStore,
  projectId: string,
  sessionId: string,
  now: number,
): StoreResult<LeaseResult> => {
  const store = releaseExpiredLeases(input, now)
  const ownedProjectId = store.sessionProjects.get(sessionId)
  if (ownedProjectId && ownedProjectId !== projectId) {
    return {
      store,
      result: { ok: false, code: 'session-already-watching', projectId: ownedProjectId },
    }
  }

  const project = store.projects.get(projectId)
  if (!project) {
    return { store, result: { ok: false, code: 'project-not-found', projectId } }
  }

  if (project.lease && project.lease.sessionId !== sessionId) {
    const conflicted = replaceProject(store, { ...project, conflictAt: now })
    return {
      store: conflicted,
      result: { ok: false, code: 'lease-conflict', projectId },
    }
  }

  const lease: AgentLease = {
    sessionId,
    heartbeatAt: now,
    mode: project.lease?.mode ?? 'watching',
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
): StoreResult<LeaseResult> => {
  const store = releaseExpiredLeases(input, now)
  const project = store.projects.get(projectId)
  if (!project) {
    return { store, result: { ok: false, code: 'project-not-found', projectId } }
  }
  if (!project.lease || project.lease.sessionId !== sessionId) {
    return { store, result: { ok: false, code: 'lease-conflict', projectId } }
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

export const releaseLease = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): HubStore => {
  const project = store.projects.get(projectId)
  if (!project?.lease || project.lease.sessionId !== sessionId) return store
  const released = replaceProject(store, { ...project, lease: null, queue: [] })
  const sessionProjects = new Map(released.sessionProjects)
  sessionProjects.delete(sessionId)
  return { ...released, sessionProjects }
}

const setLeaseMode = (
  store: HubStore,
  projectId: string,
  sessionId: string,
  mode: AgentLease['mode'],
): HubStore => {
  const project = store.projects.get(projectId)
  if (!project?.lease || project.lease.sessionId !== sessionId) return store
  return replaceProject(store, {
    ...project,
    lease: { ...project.lease, mode },
  })
}

export const markLeaseWatching = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): HubStore => setLeaseMode(store, projectId, sessionId, 'watching')

export const markLeaseBusy = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): HubStore => setLeaseMode(store, projectId, sessionId, 'busy')

export const dispatchIssue = (
  store: HubStore,
  projectId: string,
  pageUrl: string,
  issue: VibeIssue,
  now: number,
): StoreResult<DispatchIssueResponse> => {
  const project = store.projects.get(projectId)
  const state = project ? leaseState(project.lease, now) : 'no-agent'
  if (!project || state === 'no-agent' || state === 'stale') {
    return {
      store,
      result: { ok: false, code: 'agent-not-watching', projectId, queueDepth: project?.queue.length ?? 0 },
    }
  }
  if (!project.store.latestSnapshot) {
    return {
      store,
      result: { ok: false, code: 'invalid-issue', projectId, queueDepth: project.queue.length },
    }
  }
  if (project.queue.length >= MAX_DISPATCH_QUEUE) {
    return {
      store,
      result: { ok: false, code: 'queue-full', projectId, queueDepth: project.queue.length },
    }
  }

  const queue = [
    ...project.queue,
    {
      projectId,
      issueKey: getStableIssueKey(projectId, pageUrl, issue),
      issue,
      snapshot: project.store.latestSnapshot,
      dispatchedAt: now,
    },
  ]
  return {
    store: replaceProject(store, { ...project, queue }),
    result: { ok: true, code: 'dispatched', projectId, queueDepth: queue.length },
  }
}

export const dequeueIssue = (
  store: HubStore,
  projectId: string,
  sessionId: string,
): { readonly store: HubStore; readonly issue: QueuedIssue | null } => {
  const project = store.projects.get(projectId)
  if (!project?.lease || project.lease.sessionId !== sessionId || project.queue.length === 0) {
    return { store, issue: null }
  }
  const [issue, ...queue] = project.queue
  return {
    store: replaceProject(store, { ...project, queue }),
    issue: issue ?? null,
  }
}

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
  return current ?? projectStore.issueHistory.find((issue) => issue.id === issueId)
}

export const acknowledgeProjectIssue = (
  store: HubStore,
  projectId: string,
  issueId: string,
): HubStore => {
  const project = store.projects.get(projectId)
  return project
    ? replaceProject(store, { ...project, store: acknowledgeIssue(project.store, issueId) })
    : store
}

export const resolveProjectIssue = (
  store: HubStore,
  projectId: string,
  issueId: string,
): HubStore => {
  const project = store.projects.get(projectId)
  return project
    ? replaceProject(store, { ...project, store: resolveIssue(project.store, issueId) })
    : store
}
