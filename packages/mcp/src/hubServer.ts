import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'
import {
  DETECTOR_NAMES,
  HUB_MAX_BODY_BYTES,
  MAX_WATCH_WAIT_SECONDS,
  SEVERITIES,
  isHostHeaderAllowed,
  isJsonContentType,
  isOriginAllowed,
  safeDecodePathSegments,
  type HubErrorBody,
  type HubErrorCode,
} from '@wcgw/vibe-check-protocol'
import {
  acknowledgeProjectIssue,
  acquireLease,
  confirmDelivery,
  createHubStore,
  dispatchIssue,
  evictIdleProjects,
  findProjectIssue,
  getActiveIssues,
  getPersistableProject,
  getProjectImpact,
  getProjectStatus,
  getProjectWorkflow,
  getVerificationStatus,
  handOffIssue,
  heartbeatLease,
  listActiveProjects,
  markWatchEnded,
  markWatchStarted,
  recordSnapshot,
  releaseLease,
  requestProjectVerification,
  resetProjectImpact,
  resolveProjectIssue,
  restoreProject,
  returnDelivery,
  requeueAllExpiredDeliveries,
  type HubStore,
  type WaitingLookup,
} from './hubStore.js'
import {
  parseDeliveryReceiptRequest,
  parseDispatchIssueRequest,
  parseIssueActionRequest,
  parseLeaseRequest,
  parseProjectSnapshotEnvelope,
  parseWaitRequest,
} from './schema.js'
import type { DetectorName, QueuedIssue, Severity, VibeSnapshot } from './types.js'
import {
  defaultProjectRegistryPath,
  listRegisteredOrigins,
  resolveProjectRoot,
} from './projectRegistry.js'
import { readPersistedProject, writePersistedProject } from './persistence.js'
import { deriveProjectImpact } from './impact.js'

const REGISTRY_ORIGIN_TTL_MS = 5_000

const hubError = (code: HubErrorCode, error: string, hint?: string): HubErrorBody =>
  hint === undefined ? { error, code } : { error, code, hint }

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
  /** Extra browser origins (normalizeOriginPattern form). Loopback is always allowed. */
  readonly allowedOrigins?: readonly string[]
  /** Extra Host headers accepted in addition to loopback on the bound port. */
  readonly allowedHosts?: readonly string[]
  /** Called once per distinct blocked Origin (mcp-cli prints a hint). */
  readonly onBlockedOrigin?: (origin: string) => void
}

export interface HubServerContext {
  readonly server: Server
  readonly getStore: () => HubStore
  readonly close: () => Promise<void>
}

const readBody = (req: IncomingMessage, maxBytes: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalBytes = 0
    let settled = false
    const fail = (error: Error): void => {
      if (settled) return
      settled = true
      req.destroy()
      reject(error)
    }
    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        fail(Object.assign(new Error('Request body too large'), { code: 'payload-too-large' }))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      resolve(Buffer.concat(chunks))
    })
    req.on('error', (error) => fail(error instanceof Error ? error : new Error(String(error))))
  })

const corsHeadersFor = (
  origin: string | undefined,
  allowPrivateNetwork: boolean,
): Record<string, string> => {
  if (origin === undefined) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    ...(allowPrivateNetwork ? { 'Access-Control-Allow-Private-Network': 'true' } : {}),
  }
}

export const createHubServer = ({
  version,
  now = Date.now,
  registryPath = defaultProjectRegistryPath(),
  onPersistenceWarning,
  allowedOrigins = [],
  allowedHosts = [],
  onBlockedOrigin,
}: HubServerOptions): HubServerContext => {
  let store = createHubStore()
  const issueWaiters = new Map<string, Set<PendingWaiter<QueuedIssue>>>()
  const snapshotWaiters = new Map<string, Set<PendingWaiter<VibeSnapshot>>>()
  const projectRoots = new Map<string, string | null>()
  const registeredIds = new Set<string>()
  const workflowLoads = new Map<string, Promise<void>>()
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>()
  const activeWrites = new Set<Promise<void>>()
  let registryOrigins: readonly string[] = []
  let registryOriginsAt = 0
  let registryOriginsLoading: Promise<readonly string[]> | null = null

  const warn = (message: string): void => onPersistenceWarning?.(message)

  const waiting: WaitingLookup = (projectId, sessionId) => {
    const waiters = issueWaiters.get(projectId)
    if (!waiters) return false
    for (const waiter of waiters) {
      if (waiter.sessionId === sessionId && !waiter.res.destroyed && !waiter.res.writableEnded) {
        return true
      }
    }
    return false
  }

  const boundPort = (): number => {
    const address = server.address()
    return typeof address === 'object' && address !== null ? address.port : 0
  }

  const refreshRegistryOrigins = async (force = false): Promise<readonly string[]> => {
    const age = now() - registryOriginsAt
    if (!force && registryOriginsAt > 0 && age < REGISTRY_ORIGIN_TTL_MS) return registryOrigins
    if (registryOriginsLoading) return registryOriginsLoading
    registryOriginsLoading = listRegisteredOrigins(registryPath)
      .then((origins) => {
        registryOrigins = origins
        registryOriginsAt = now()
        return origins
      })
      .catch((error) => {
        warn(error instanceof Error ? error.message : String(error))
        return registryOrigins
      })
      .finally(() => {
        registryOriginsLoading = null
      })
    return registryOriginsLoading
  }

  const effectiveOrigins = (): readonly string[] => [...allowedOrigins, ...registryOrigins]

  const ensureLoaded = (projectId: string): Promise<void> => {
    const existing = workflowLoads.get(projectId)
    if (existing) return existing
    const loading = (async () => {
      try {
        const root = await resolveProjectRoot(registryPath, projectId)
        projectRoots.set(projectId, root)
        if (root) registeredIds.add(projectId)
        if (!root) return
        const persisted = await readPersistedProject(
          join(root, '.vibecheck/state.json'),
          projectId,
          warn,
        )
        store = restoreProject(store, projectId, persisted, now())
      } catch (error) {
        projectRoots.set(projectId, null)
        warn(error instanceof Error ? error.message : String(error))
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
    const persistable = getPersistableProject(store, projectId)
    if (!root || !persistable) return
    try {
      await writePersistedProject(join(root, '.vibecheck/state.json'), persistable)
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

  const sendJson = (
    res: ServerResponse,
    status: number,
    body: unknown,
    corsOrigin?: string,
  ): void => {
    if (res.writableEnded) return
    res.writeHead(status, {
      ...corsHeadersFor(corsOrigin, false),
      'Content-Type': 'application/json',
    })
    res.end(JSON.stringify(body))
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
    onClose?: () => void,
  ): void => {
    let waiter: PendingWaiter<T>
    const timer = setTimeout(() => {
      resolveWaiter(map, projectId, waiter, null)
      onClose?.()
    }, timeoutSeconds * 1_000)
    waiter = { sessionId, res, timer, value }
    const waiters = map.get(projectId) ?? new Set<PendingWaiter<T>>()
    waiters.add(waiter)
    map.set(projectId, waiters)
    res.on('close', () => {
      if (!waiters.has(waiter)) return
      clearTimeout(timer)
      removeWaiter(map, projectId, waiter)
      onClose?.()
    })
  }

  const flushIssueWaiters = (projectId: string): void => {
    store = requeueAllExpiredDeliveries(store, now()).store
    const waiters = [...(issueWaiters.get(projectId) ?? [])]
    for (const waiter of waiters) {
      if (waiter.res.destroyed || waiter.res.writableEnded) {
        clearTimeout(waiter.timer)
        removeWaiter(issueWaiters, projectId, waiter)
        continue
      }
      const handed = handOffIssue(store, projectId, waiter.sessionId, now())
      if (!handed.issue) continue
      store = handed.store
      schedulePersist(projectId)
      resolveWaiter(issueWaiters, projectId, waiter, handed.issue)
      return
    }
  }

  const flushSnapshotWaiters = (projectId: string): void => {
    const waiters = [...(snapshotWaiters.get(projectId) ?? [])]
    for (const waiter of waiters) resolveWaiter(snapshotWaiters, projectId, waiter, waiter.value())
  }

  const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
    const raw = await readBody(req, HUB_MAX_BODY_BYTES)
    try {
      return JSON.parse(raw.toString('utf8')) as unknown
    } catch {
      throw Object.assign(new Error('Invalid JSON body'), { code: 'invalid-json' })
    }
  }

  const server = createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET'
      const requestUrl = new URL(req.url ?? '/', 'http://localhost')
      const browserRoute = requestUrl.pathname.startsWith('/api/')
      const internalRoute = requestUrl.pathname.startsWith('/internal/')
      const originHeader = typeof req.headers.origin === 'string' ? req.headers.origin : undefined
      const hostHeader = typeof req.headers.host === 'string' ? req.headers.host : undefined
      const port = boundPort()

      try {
        if (!isHostHeaderAllowed(hostHeader, port, allowedHosts)) {
          sendJson(res, 403, hubError(
            'host-not-allowed',
            'Host header is not allowed for this hub',
            'Use 127.0.0.1 or localhost, or restart the hub with --allow-host.',
          ))
          return
        }

        if (internalRoute && originHeader !== undefined) {
          sendJson(res, 403, hubError('origin-not-allowed', 'Bridge API does not accept browser requests'))
          return
        }

        let corsOrigin: string | undefined
        if (browserRoute && originHeader !== undefined) {
          await refreshRegistryOrigins(false)
          const allowlist = effectiveOrigins()
          if (!isOriginAllowed(originHeader, allowlist)) {
            // Unknown origin: refresh once in case register --origin just landed.
            await refreshRegistryOrigins(true)
            if (!isOriginAllowed(originHeader, effectiveOrigins())) {
              onBlockedOrigin?.(originHeader)
              sendJson(res, 403, hubError(
                'origin-not-allowed',
                'Browser origin is not allowed',
                'Start the hub with --allow-origin <origin> or set VIBE_CHECK_ALLOWED_ORIGINS.',
              ))
              return
            }
          }
          corsOrigin = originHeader
        }

        if (method === 'OPTIONS' && browserRoute) {
          if (corsOrigin === undefined && originHeader !== undefined) {
            // Disallowed preflight already returned 403 above.
            return
          }
          const wantsPrivateNetwork = req.headers['access-control-request-private-network'] === 'true'
          res.writeHead(204, corsHeadersFor(corsOrigin, wantsPrivateNetwork))
          res.end()
          return
        }

        const parts = safeDecodePathSegments(requestUrl.pathname)
        if (parts === null) {
          sendJson(res, 400, hubError('bad-request', 'Malformed request path'), corsOrigin)
          return
        }

        if (method === 'POST') {
          if (!isJsonContentType(req.headers['content-type'])) {
            sendJson(res, 415, hubError(
              'unsupported-media-type',
              'POST bodies must be application/json',
            ), corsOrigin)
            return
          }
        }

        if (method === 'GET' && requestUrl.pathname === '/api/health') {
          sendJson(res, 200, { status: 'ok', service: 'vibe-check-hub', version }, corsOrigin)
          return
        }

        if (method === 'POST' && requestUrl.pathname === '/api/snapshot') {
          const envelope = parseProjectSnapshotEnvelope(await readJsonBody(req))
          if (!envelope) {
            sendJson(res, 400, hubError('bad-request', 'Invalid project snapshot envelope'), corsOrigin)
            return
          }
          await ensureLoaded(envelope.projectId)
          const eviction = evictIdleProjects(store, now(), (id) => registeredIds.has(id))
          store = eviction.store
          store = recordSnapshot(store, envelope, now())
          schedulePersist(envelope.projectId)
          flushSnapshotWaiters(envelope.projectId)
          sendJson(res, 200, { received: true, projectId: envelope.projectId }, corsOrigin)
          return
        }

        if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'status') {
          const status = getProjectStatus(store, parts[2] ?? '', now(), waiting)
          sendJson(res, status ? 200 : 404, status ?? hubError('project-not-found', 'Project not found'), corsOrigin)
          return
        }

        if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'workflow') {
          const workflow = getProjectWorkflow(store, parts[2] ?? '')
          sendJson(res, workflow ? 200 : 404, workflow ?? hubError('project-not-found', 'Project not found'), corsOrigin)
          return
        }

        if (method === 'GET' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'impact') {
          const projectId = parts[2] ?? ''
          const activeImpact = getProjectImpact(store, projectId)
          if (activeImpact) {
            sendJson(res, 200, activeImpact, corsOrigin)
            return
          }
          await ensureLoaded(projectId)
          const workflow = getProjectWorkflow(store, projectId)
          const impact = workflow ? deriveProjectImpact(workflow, workflow.impactReceipts) : null
          sendJson(res, impact ? 200 : 404, impact ?? hubError('project-not-found', 'Project not found'), corsOrigin)
          return
        }

        if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects'
          && parts[3] === 'impact' && parts[4] === 'reset') {
          const projectId = parts[2] ?? ''
          if (!store.projects.has(projectId)) {
            sendJson(res, 404, hubError('project-not-found', 'Project not found'), corsOrigin)
            return
          }
          store = resetProjectImpact(store, projectId, now())
          schedulePersist(projectId)
          sendJson(res, 200, { reset: true, projectId }, corsOrigin)
          return
        }

        if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects'
          && parts[3] === 'issues' && parts[4] && parts[5] === 'verify') {
          const projectId = parts[2] ?? ''
          const issueId = parts[4]
          await ensureLoaded(projectId)
          const result = requestProjectVerification(store, projectId, issueId, now())
          store = result.store
          if (result.result.ok) schedulePersist(projectId)
          const status = result.result.ok
            ? 200
            : result.result.code === 'lease-conflict'
              ? 409
              : 404
          sendJson(res, status, result.result, corsOrigin)
          return
        }

        if (method === 'POST' && parts[0] === 'api' && parts[1] === 'projects' && parts[3] === 'dispatch') {
          const projectId = parts[2] ?? ''
          const request = parseDispatchIssueRequest(await readJsonBody(req))
          if (!request || request.projectId !== projectId) {
            sendJson(res, 400, hubError('bad-request', 'Invalid issue dispatch'), corsOrigin)
            return
          }
          await ensureLoaded(projectId)
          store = requeueAllExpiredDeliveries(store, now()).store
          const deliveryId = randomUUID()
          const dispatched = dispatchIssue(
            store,
            projectId,
            request.pageUrl,
            request.issue,
            now(),
            deliveryId,
          )
          store = dispatched.store
          if (dispatched.result.ok) {
            schedulePersist(projectId)
            flushIssueWaiters(projectId)
            // If a waiter took it, surface 'dispatched' instead of 'queued'.
            const project = store.projects.get(projectId)
            const inFlight = project?.inFlight.some((delivery) =>
              delivery.item.deliveryId === (dispatched.result.ok ? dispatched.result.deliveryId : ''))
            if (inFlight && dispatched.result.ok) {
              sendJson(res, 200, {
                ...dispatched.result,
                code: 'dispatched' as const,
                queueDepth: project?.queue.length ?? 0,
              }, corsOrigin)
              return
            }
          }
          const status = dispatched.result.ok
            ? 200
            : dispatched.result.code === 'queue-full'
              ? 429
              : 409
          sendJson(res, status, dispatched.result, corsOrigin)
          return
        }

        if (method === 'GET' && requestUrl.pathname === '/internal/projects') {
          sendJson(res, 200, listActiveProjects(store, now(), waiting))
          return
        }

        if (parts[0] === 'internal' && parts[1] === 'projects' && parts[2]) {
          const projectId = parts[2]
          await ensureLoaded(projectId)

          if (method === 'GET' && parts[3] === 'snapshot') {
            sendJson(res, 200, store.projects.get(projectId)?.store.latestSnapshot ?? null)
            return
          }

          if (method === 'GET' && parts[3] === 'issues' && parts.length === 4) {
            const severityValue = requestUrl.searchParams.get('severity')
            const detectorValue = requestUrl.searchParams.get('detector')
            const severity = SEVERITIES.includes(severityValue as Severity)
              ? severityValue as Severity
              : undefined
            const detector = DETECTOR_NAMES.includes(detectorValue as DetectorName)
              ? detectorValue as DetectorName
              : undefined
            sendJson(res, 200, getActiveIssues(store, projectId, { severity, detector }))
            return
          }

          if (method === 'GET' && parts[3] === 'issues' && parts[4] && parts[5] === 'verification') {
            const lookup = getVerificationStatus(store, projectId, parts[4])
            if (!lookup.ok) {
              sendJson(res, 404, hubError(
                lookup.code === 'project-not-found' ? 'project-not-found' : 'issue-not-found',
                lookup.code === 'project-not-found' ? 'Project not found' : 'Issue not found',
              ))
              return
            }
            sendJson(res, 200, lookup.status)
            return
          }

          if (method === 'GET' && parts[3] === 'issues' && parts[4]) {
            const issue = findProjectIssue(store, projectId, parts[4])
            sendJson(res, issue ? 200 : 404, issue ?? hubError('issue-not-found', 'Issue not found'))
            return
          }

          if (method === 'POST' && parts[3] === 'leases' && parts[4]) {
            const request = parseLeaseRequest(await readJsonBody(req))
            if (!request) {
              sendJson(res, 400, hubError('bad-request', 'Invalid lease request'))
              return
            }
            if (parts[4] === 'acquire') {
              const acquired = acquireLease(
                store,
                projectId,
                request.sessionId,
                now(),
                request.clientName,
                waiting,
              )
              store = acquired.store
              sendJson(res, acquired.result.ok ? 200 : 409, acquired.result)
              return
            }
            if (parts[4] === 'heartbeat') {
              const heartbeat = heartbeatLease(store, projectId, request.sessionId, now(), waiting)
              store = heartbeat.store
              sendJson(res, heartbeat.result.ok ? 200 : 409, heartbeat.result)
              return
            }
            if (parts[4] === 'release') {
              store = releaseLease(store, projectId, request.sessionId)
              schedulePersist(projectId)
              sendJson(res, 200, { released: true, projectId })
              return
            }
          }

          if (method === 'POST' && parts[3] === 'deliveries' && parts[4] && parts[5]) {
            const request = parseDeliveryReceiptRequest(await readJsonBody(req))
            if (!request || request.deliveryId !== parts[4]) {
              sendJson(res, 400, hubError('bad-request', 'Invalid delivery receipt'))
              return
            }
            store = requeueAllExpiredDeliveries(store, now()).store
            if (parts[5] === 'ack') {
              const confirmed = confirmDelivery(store, projectId, request.sessionId, request.deliveryId, now())
              store = confirmed.store
              if (confirmed.result.ok) schedulePersist(projectId)
              const status = confirmed.result.ok
                ? 200
                : confirmed.result.code === 'lease-conflict'
                  ? 409
                  : 404
              sendJson(res, status, confirmed.result)
              return
            }
            if (parts[5] === 'nack') {
              const returned = returnDelivery(store, projectId, request.sessionId, request.deliveryId, now())
              store = returned.store
              if (returned.result.ok) {
                schedulePersist(projectId)
                flushIssueWaiters(projectId)
              }
              const status = returned.result.ok
                ? 200
                : returned.result.code === 'lease-conflict'
                  ? 409
                  : 404
              sendJson(res, status, returned.result)
              return
            }
          }

          if (method === 'POST' && parts[3] === 'issues' && parts[4] === 'next') {
            const request = parseWaitRequest(await readJsonBody(req))
            if (!request) {
              sendJson(res, 400, hubError('bad-request', 'Invalid wait request'))
              return
            }
            const timeoutSeconds = Math.min(request.timeoutSeconds, MAX_WATCH_WAIT_SECONDS)
            const heartbeat = heartbeatLease(store, projectId, request.sessionId, now(), waiting)
            store = heartbeat.store
            if (!heartbeat.result.ok) {
              sendJson(res, 409, heartbeat.result)
              return
            }
            store = requeueAllExpiredDeliveries(store, now()).store
            store = markWatchStarted(store, projectId, request.sessionId)
            const immediate = handOffIssue(store, projectId, request.sessionId, now())
            store = immediate.store
            if (immediate.issue) {
              schedulePersist(projectId)
              sendJson(res, 200, immediate.issue)
              return
            }
            addWaiter(
              issueWaiters,
              projectId,
              request.sessionId,
              timeoutSeconds,
              res,
              () => null,
              () => {
                store = markWatchEnded(store, projectId, request.sessionId, now())
              },
            )
            return
          }

          if (method === 'POST' && parts[3] === 'snapshots' && parts[4] === 'next') {
            const request = parseWaitRequest(await readJsonBody(req))
            if (!request) {
              sendJson(res, 400, hubError('bad-request', 'Invalid wait request'))
              return
            }
            const timeoutSeconds = Math.min(request.timeoutSeconds, MAX_WATCH_WAIT_SECONDS)
            const heartbeat = heartbeatLease(store, projectId, request.sessionId, now(), waiting)
            store = heartbeat.store
            if (!heartbeat.result.ok) {
              sendJson(res, 409, heartbeat.result)
              return
            }
            addWaiter(
              snapshotWaiters,
              projectId,
              request.sessionId,
              timeoutSeconds,
              res,
              () => store.projects.get(projectId)?.store.latestSnapshot ?? null,
            )
            return
          }

          if (method === 'POST' && parts[3] === 'issues' && parts[4] && parts[5]) {
            const issueId = parts[4]
            const action = parseIssueActionRequest(await readJsonBody(req))
            if (!action) {
              sendJson(res, 400, hubError('bad-request', 'Issue actions require a sessionId'))
              return
            }
            if (parts[5] === 'acknowledge') {
              const result = acknowledgeProjectIssue(
                store, projectId, action.sessionId, issueId, now(), waiting,
              )
              store = result.store
              if (result.result.ok) schedulePersist(projectId)
              const status = result.result.ok
                ? 200
                : result.result.code === 'lease-conflict'
                  ? 409
                  : 404
              sendJson(res, status, result.result)
              return
            }
            if (parts[5] === 'resolve') {
              const result = resolveProjectIssue(
                store, projectId, action.sessionId, issueId, now(), waiting,
              )
              store = result.store
              if (result.result.ok) schedulePersist(projectId)
              const status = result.result.ok
                ? 200
                : result.result.code === 'lease-conflict'
                  ? 409
                  : 404
              sendJson(res, status, result.result)
              return
            }
          }
        }

        sendJson(res, 404, hubError('not-found', 'Not found'), corsOrigin)
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code: unknown }).code)
          : null
        if (code === 'payload-too-large') {
          sendJson(res, 413, hubError('payload-too-large', 'Request body too large'))
          return
        }
        if (code === 'invalid-json') {
          sendJson(res, 400, hubError('invalid-json', 'Invalid JSON body'),
            browserRoute && originHeader && isOriginAllowed(originHeader, effectiveOrigins())
              ? originHeader
              : undefined)
          return
        }
        warn(error instanceof Error ? error.stack ?? error.message : String(error))
        sendJson(res, 500, hubError('internal-error', 'Internal hub error'))
      }
    })()
  })

  const close = async (): Promise<void> => {
    for (const map of [issueWaiters, snapshotWaiters] as const) {
      for (const waiters of map.values()) {
        for (const waiter of waiters) {
          clearTimeout(waiter.timer)
          if (!waiter.res.writableEnded) {
            sendJson(waiter.res, 503, hubError('hub-shutting-down', 'Hub shutting down'))
          }
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
