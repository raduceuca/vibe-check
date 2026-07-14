import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import { DETECTOR_NAMES, SEVERITIES } from '@wcgw/vibe-check-protocol'
import {
  acknowledgeProjectIssue,
  acquireLease,
  createHubStore,
  dequeueIssue,
  dispatchIssue,
  findProjectIssue,
  getActiveIssues,
  getProjectImpact,
  getProjectWorkflow,
  getProjectStatus,
  heartbeatLease,
  listActiveProjects,
  markLeaseBusy,
  markLeaseWatching,
  recordSnapshot,
  releaseLease,
  requestProjectVerification,
  resetProjectImpact,
  resolveProjectIssue,
  type HubStore,
} from './hubStore.js'
import {
  parseDispatchIssueRequest,
  parseLeaseRequest,
  parseProjectSnapshotEnvelope,
  parseWaitRequest,
} from './schema.js'
import type { DetectorName, QueuedIssue, Severity, VibeSnapshot } from './types.js'
import type { ProjectWorkflow } from './types.js'
import {
  defaultProjectRegistryPath,
  resolveProjectRoot,
} from './projectRegistry.js'
import { readPersistedWorkflow, writePersistedWorkflow } from './persistence.js'

const MAX_BODY_BYTES = 1_048_576

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const readBody = (req: IncomingMessage): Promise<string> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = []
  let totalBytes = 0
  req.on('data', (chunk: Buffer) => {
    totalBytes += chunk.length
    if (totalBytes > MAX_BODY_BYTES) {
      req.destroy()
      reject(new Error('Request body too large'))
      return
    }
    chunks.push(chunk)
  })
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  req.on('error', reject)
})

const readJson = async (req: IncomingMessage): Promise<unknown> => JSON.parse(await readBody(req)) as unknown

const sendJson = (
  res: ServerResponse,
  status: number,
  body: unknown,
  browserRoute = false,
): void => {
  res.writeHead(status, {
    ...(browserRoute ? CORS_HEADERS : {}),
    'Content-Type': 'application/json',
  })
  res.end(JSON.stringify(body))
}

interface PendingWaiter<T> {
  readonly sessionId: string
  readonly res: ServerResponse
  readonly timer: ReturnType<typeof setTimeout>
  readonly value: () => T | null
}

export interface HubServerOptions {
  readonly version: string
  readonly now?: () => number
  readonly registryPath?: string
  readonly onPersistenceWarning?: (message: string) => void
}

export interface HubServerContext {
  readonly server: Server
  readonly getStore: () => HubStore
  readonly close: () => Promise<void>
}

export const createHubServer = ({
  version,
  now = Date.now,
  registryPath = defaultProjectRegistryPath(),
  onPersistenceWarning,
}: HubServerOptions): HubServerContext => {
  let store = createHubStore()
  const issueWaiters = new Map<string, Set<PendingWaiter<QueuedIssue>>>()
  const snapshotWaiters = new Map<string, Set<PendingWaiter<VibeSnapshot>>>()
  const projectRoots = new Map<string, string | null>()
  const workflowLoads = new Map<string, Promise<ProjectWorkflow | null>>()
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
  const activeWrites = new Set<Promise<void>>()

  const warn = (message: string): void => onPersistenceWarning?.(message)

  const ensureLoaded = (projectId: string): Promise<ProjectWorkflow | null> => {
    const existing = workflowLoads.get(projectId)
    if (existing) return existing
    const loading = (async () => {
      try {
        const root = await resolveProjectRoot(registryPath, projectId)
        projectRoots.set(projectId, root)
        return root
          ? await readPersistedWorkflow(
            join(root, '.vibecheck/state.json'),
            projectId,
            warn,
          )
          : null
      } catch (error) {
        projectRoots.set(projectId, null)
        warn(error instanceof Error ? error.message : String(error))
        return null
      }
    })()
    workflowLoads.set(projectId, loading)
    return loading
  }

  const flushProject = async (projectId: string): Promise<void> => {
    const timer = pendingWrites.get(projectId)
    if (timer) clearTimeout(timer)
    pendingWrites.delete(projectId)
    const root = projectRoots.get(projectId)
    const workflow = getProjectWorkflow(store, projectId)
    if (!root || !workflow) return
    try {
      await writePersistedWorkflow(join(root, '.vibecheck/state.json'), workflow)
    } catch (error) {
      warn(`Could not persist VibeCheck state for "${projectId}": ${
        error instanceof Error ? error.message : String(error)
      }`)
    }
  }

  const trackWrite = (projectId: string): void => {
    const writing = flushProject(projectId)
    activeWrites.add(writing)
    void writing.finally(() => activeWrites.delete(writing))
  }

  const schedulePersist = (projectId: string): void => {
    if (!projectRoots.get(projectId)) return
    const previous = pendingWrites.get(projectId)
    if (previous) clearTimeout(previous)
    pendingWrites.set(projectId, setTimeout(() => trackWrite(projectId), 100))
  }

  const removeWaiter = <T>(
    map: Map<string, Set<PendingWaiter<T>>>,
    projectId: string,
    waiter: PendingWaiter<T>,
  ): void => {
    const waiters = map.get(projectId)
    waiters?.delete(waiter)
    if (waiters?.size === 0) map.delete(projectId)
  }

  const resolveWaiter = <T>(
    map: Map<string, Set<PendingWaiter<T>>>,
    projectId: string,
    waiter: PendingWaiter<T>,
    value: T | null,
  ): void => {
    clearTimeout(waiter.timer)
    removeWaiter(map, projectId, waiter)
    if (!waiter.res.writableEnded) sendJson(waiter.res, 200, value)
  }

  const addWaiter = <T>(
    map: Map<string, Set<PendingWaiter<T>>>,
    projectId: string,
    sessionId: string,
    timeoutSeconds: number,
    res: ServerResponse,
    value: () => T | null,
  ): void => {
    let waiter: PendingWaiter<T>
    const timer = setTimeout(() => resolveWaiter(map, projectId, waiter, null), timeoutSeconds * 1_000)
    waiter = { sessionId, res, timer, value }
    const waiters = map.get(projectId) ?? new Set<PendingWaiter<T>>()
    waiters.add(waiter)
    map.set(projectId, waiters)
    res.on('close', () => {
      clearTimeout(timer)
      removeWaiter(map, projectId, waiter)
    })
  }

  const flushIssueWaiter = (projectId: string): void => {
    const waiters = issueWaiters.get(projectId)
    const waiter = waiters?.values().next().value as PendingWaiter<QueuedIssue> | undefined
    if (!waiter) return
    const dequeued = dequeueIssue(store, projectId, waiter.sessionId, now())
    if (!dequeued.issue) return
    store = markLeaseBusy(dequeued.store, projectId, waiter.sessionId)
    schedulePersist(projectId)
    resolveWaiter(issueWaiters, projectId, waiter, dequeued.issue)
  }

  const flushSnapshotWaiters = (projectId: string): void => {
    const waiters = [...(snapshotWaiters.get(projectId) ?? [])]
    for (const waiter of waiters) resolveWaiter(snapshotWaiters, projectId, waiter, waiter.value())
  }

  const server = createServer(async (req, res) => {
    const method = req.method ?? 'GET'
    const requestUrl = new URL(req.url ?? '/', 'http://localhost')
    const browserRoute = requestUrl.pathname.startsWith('/api/')
    const internalRoute = requestUrl.pathname.startsWith('/internal/')

    if (internalRoute && req.headers.origin) {
      sendJson(res, 403, { error: 'Bridge API does not accept browser requests' })
      return
    }
    if (method === 'OPTIONS' && browserRoute) {
      res.writeHead(204, CORS_HEADERS)
      res.end()
      return
    }

    const parts = requestUrl.pathname.split('/').filter(Boolean).map((part) => decodeURIComponent(part))

    try {
      if (method === 'GET' && requestUrl.pathname === '/api/health') {
        sendJson(res, 200, { status: 'ok', service: 'vibe-check-hub', version }, true)
        return
      }

      if (method === 'POST' && requestUrl.pathname === '/api/snapshot') {
        const envelope = parseProjectSnapshotEnvelope(await readJson(req))
        if (!envelope) {
          sendJson(res, 400, { error: 'Invalid project snapshot envelope' }, true)
          return
        }
        const restoredWorkflow = await ensureLoaded(envelope.projectId)
        store = recordSnapshot(store, envelope, now(), restoredWorkflow ?? undefined)
        schedulePersist(envelope.projectId)
        flushSnapshotWaiters(envelope.projectId)
        sendJson(res, 200, { received: true, projectId: envelope.projectId }, true)
        return
      }

      if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'status') {
        const status = getProjectStatus(store, parts[2] ?? '', now())
        sendJson(res, status ? 200 : 404, status ?? { error: 'Project not found' }, true)
        return
      }

      if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'workflow') {
        const workflow = getProjectWorkflow(store, parts[2] ?? '')
        sendJson(res, workflow ? 200 : 404, workflow ?? { error: 'Project not found' }, true)
        return
      }

      if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'impact') {
        const impact = getProjectImpact(store, parts[2] ?? '')
        sendJson(res, impact ? 200 : 404, impact ?? { error: 'Project not found' }, true)
        return
      }

      if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects'
        && parts[3] === 'impact' && parts[4] === 'reset') {
        const projectId = parts[2] ?? ''
        if (!store.projects.has(projectId)) {
          sendJson(res, 404, { error: 'Project not found' }, true)
          return
        }
        store = resetProjectImpact(store, projectId, now())
        schedulePersist(projectId)
        sendJson(res, 200, { reset: true, projectId }, true)
        return
      }

      if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects'
        && parts[3] === 'issues' && parts[4] && parts[5] === 'verify') {
        const projectId = parts[2] ?? ''
        const issueId = parts[4]
        if (!findProjectIssue(store, projectId, issueId)) {
          sendJson(res, 404, { error: 'Issue not found', projectId, issueId }, true)
          return
        }
        store = requestProjectVerification(store, projectId, issueId, now())
        schedulePersist(projectId)
        sendJson(res, 200, { verifying: true, projectId, issueId }, true)
        return
      }

      if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'dispatch') {
        const projectId = parts[2] ?? ''
        const request = parseDispatchIssueRequest(await readJson(req))
        if (!request || request.projectId !== projectId) {
          sendJson(res, 400, { error: 'Invalid issue dispatch' }, true)
          return
        }
        const dispatched = dispatchIssue(store, projectId, request.pageUrl, request.issue, now())
        store = dispatched.store
        if (dispatched.result.ok) {
          schedulePersist(projectId)
          flushIssueWaiter(projectId)
        }
        const status = dispatched.result.ok ? 200 : dispatched.result.code === 'queue-full' ? 429 : 409
        sendJson(res, status, dispatched.result, true)
        return
      }

      if (method === 'GET' && requestUrl.pathname === '/internal/projects') {
        sendJson(res, 200, listActiveProjects(store, now()))
        return
      }

      if (parts[0] === 'internal' && parts[1] === 'projects' && parts[2]) {
        const projectId = parts[2]

        if (method === 'GET' && parts[3] === 'snapshot') {
          sendJson(res, 200, store.projects.get(projectId)?.store.latestSnapshot ?? null)
          return
        }

        if (method === 'GET' && parts[3] === 'issues' && parts.length === 4) {
          const severityValue = requestUrl.searchParams.get('severity')
          const detectorValue = requestUrl.searchParams.get('detector')
          const severity = SEVERITIES.includes(severityValue as Severity) ? severityValue as Severity : undefined
          const detector = DETECTOR_NAMES.includes(detectorValue as DetectorName) ? detectorValue as DetectorName : undefined
          sendJson(res, 200, getActiveIssues(store, projectId, { severity, detector }))
          return
        }

        if (method === 'GET' && parts[3] === 'issues' && parts[4]) {
          const issue = findProjectIssue(store, projectId, parts[4])
          sendJson(res, issue ? 200 : 404, issue ?? { error: 'Issue not found' })
          return
        }

        if (method === 'POST' && parts[3] === 'leases' && parts[4]) {
          const request = parseLeaseRequest(await readJson(req))
          if (!request) {
            sendJson(res, 400, { error: 'Invalid lease request' })
            return
          }
          if (parts[4] === 'acquire') {
            const acquired = acquireLease(store, projectId, request.sessionId, now())
            store = acquired.store
            sendJson(res, acquired.result.ok ? 200 : 409, acquired.result)
            return
          }
          if (parts[4] === 'heartbeat') {
            const heartbeat = heartbeatLease(store, projectId, request.sessionId, now())
            store = heartbeat.store
            sendJson(res, heartbeat.result.ok ? 200 : 409, heartbeat.result)
            return
          }
          if (parts[4] === 'release') {
            store = releaseLease(store, projectId, request.sessionId)
            sendJson(res, 200, { released: true, projectId })
            return
          }
        }

        if (method === 'POST' && parts[3] === 'issues' && parts[4] === 'next') {
          const request = parseWaitRequest(await readJson(req))
          if (!request) {
            sendJson(res, 400, { error: 'Invalid wait request' })
            return
          }
          const heartbeat = heartbeatLease(store, projectId, request.sessionId, now())
          store = heartbeat.store
          if (!heartbeat.result.ok) {
            sendJson(res, 409, heartbeat.result)
            return
          }
          store = markLeaseWatching(store, projectId, request.sessionId)
          const immediate = dequeueIssue(store, projectId, request.sessionId, now())
          store = immediate.store
          if (immediate.issue) {
            store = markLeaseBusy(store, projectId, request.sessionId)
            schedulePersist(projectId)
            sendJson(res, 200, immediate.issue)
            return
          }
          addWaiter(issueWaiters, projectId, request.sessionId, request.timeoutSeconds, res, () => null)
          return
        }

        if (method === 'POST' && parts[3] === 'snapshots' && parts[4] === 'next') {
          const request = parseWaitRequest(await readJson(req))
          if (!request) {
            sendJson(res, 400, { error: 'Invalid wait request' })
            return
          }
          const heartbeat = heartbeatLease(store, projectId, request.sessionId, now())
          store = heartbeat.store
          if (!heartbeat.result.ok) {
            sendJson(res, 409, heartbeat.result)
            return
          }
          addWaiter(
            snapshotWaiters,
            projectId,
            request.sessionId,
            request.timeoutSeconds,
            res,
            () => store.projects.get(projectId)?.store.latestSnapshot ?? null,
          )
          return
        }

        if (method === 'POST' && parts[3] === 'issues' && parts[4] && parts[5]) {
          const issueId = parts[4]
          if (parts[5] === 'acknowledge') {
            store = acknowledgeProjectIssue(store, projectId, issueId, now())
            schedulePersist(projectId)
            sendJson(res, 200, { acknowledged: true, projectId, issueId })
            return
          }
          if (parts[5] === 'resolve') {
            store = resolveProjectIssue(store, projectId, issueId, now())
            schedulePersist(projectId)
            sendJson(res, 200, { verifying: true, projectId, issueId })
            return
          }
        }
      }

      sendJson(res, 404, { error: 'Not found' }, browserRoute)
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON body' }, browserRoute)
    }
  })

  const close = async (): Promise<void> => {
    for (const map of [issueWaiters, snapshotWaiters] as const) {
      for (const waiters of map.values()) {
        for (const waiter of waiters) {
          clearTimeout(waiter.timer)
          if (!waiter.res.writableEnded) sendJson(waiter.res, 503, { error: 'Hub shutting down' })
        }
      }
      map.clear()
    }
    const scheduledProjects = [...pendingWrites.keys()]
    await Promise.all(scheduledProjects.map((projectId) => flushProject(projectId)))
    await Promise.all([...activeWrites])
    if (!server.listening) return
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    })
  }

  return { server, getStore: () => store, close }
}
