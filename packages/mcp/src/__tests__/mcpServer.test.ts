import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMcpServer } from '../mcpServer.js'
import type { HubClient } from '../hubClient.js'
import type { LeaseManager } from '../leaseManager.js'
import type { ProjectSummary, QueuedIssue, VibeIssue, VibeSnapshot } from '../types.js'

const issue: VibeIssue = {
  id: 'dom-1',
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'DOM has 5000 nodes',
  description: 'Too many nodes',
  evidence: { nodeCount: 5000 },
  timestamp: 1,
  acknowledged: false,
  resolved: false,
}

const snapshot: VibeSnapshot = {
  timestamp: 1,
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 0, jsTransferKB: 0, cssTransferKB: 0, imageTransferKB: 0, fontTransferKB: 0, resourceCount: 0, largeResources: [] },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues: [issue],
  domNodeCount: 5000,
}

const project = (projectId: string): ProjectSummary => ({
  projectId,
  origin: projectId,
  title: projectId,
  instanceCount: 1,
  lastSeenAt: 1,
  agentState: 'no-agent',
})

const makeClient = (): HubClient => ({
  health: vi.fn(),
  listProjects: vi.fn(async () => [project('project-a')]),
  getSnapshot: vi.fn(async () => snapshot),
  getWorkflow: vi.fn(async () => null),
  requestVerification: vi.fn(),
  getDetectedIssues: vi.fn(async () => [issue]),
  getIssue: vi.fn(async (_projectId, issueId) => issueId === issue.id ? issue : null),
  waitForSnapshot: vi.fn(async () => snapshot),
  acquireLease: vi.fn(),
  heartbeatLease: vi.fn(),
  releaseLease: vi.fn(),
  waitForIssue: vi.fn(async (): Promise<QueuedIssue> => ({
    projectId: 'project-a',
    issueKey: 'project-a|fixture|dom-bloat|dom-bloat',
    issue,
    snapshot,
    dispatchedAt: 10,
  })),
  acknowledgeIssue: vi.fn(),
  resolveIssue: vi.fn(),
})

const makeLeases = (): LeaseManager => {
  let owned: string | null = null
  return {
    sessionId: 'agent-a',
    currentProjectId: () => owned,
    acquire: vi.fn(async (projectId: string) => {
      owned = projectId
      return { ok: true as const, projectId, expiresAt: 15_000 }
    }),
    release: vi.fn(async () => { owned = null }),
    stop: vi.fn(async () => { owned = null }),
  }
}

const getToolHandler = (server: ReturnType<typeof createMcpServer>['server'], toolName: string) => {
  const tools = (server as unknown as Record<string, Record<string, {
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }>>)['_registeredTools']
  const tool = tools?.[toolName]
  if (!tool) throw new Error(`Tool ${toolName} not found`)
  return tool.handler
}

const call = async (
  context: ReturnType<typeof createMcpServer>,
  name: string,
  args: Record<string, unknown> = {},
) => {
  const result = await getToolHandler(context.server, name)(args) as {
    content: Array<{ text: string }>
    isError?: boolean
  }
  return { ...result, text: result.content[0]!.text }
}

describe('project-scoped MCP server', () => {
  let client: HubClient
  let leases: LeaseManager
  let context: ReturnType<typeof createMcpServer>

  beforeEach(() => {
    client = makeClient()
    leases = makeLeases()
    context = createMcpServer(client, leases, '0.2.0')
  })

  it('lists active projects', async () => {
    const result = await call(context, 'list_projects')
    expect(JSON.parse(result.text)).toMatchObject([{ projectId: 'project-a' }])
  })

  it('selects the only active project for existing tools', async () => {
    const result = await call(context, 'get_performance_snapshot')
    expect(JSON.parse(result.text)).toMatchObject({ domNodeCount: 5000 })
    expect(client.getSnapshot).toHaveBeenCalledWith('project-a')
  })

  it('returns candidates instead of guessing between multiple projects', async () => {
    vi.mocked(client.listProjects).mockResolvedValue([project('project-a'), project('project-b')])
    const result = await call(context, 'get_detected_issues')
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.text)).toMatchObject({ code: 'project-ambiguous' })
  })

  it('waits for a dispatched issue and includes its real suggestion', async () => {
    const result = await call(context, 'watch_for_issue', {
      project_id: 'project-a',
      timeout_seconds: 30,
    })
    expect(JSON.parse(result.text)).toMatchObject({
      projectId: 'project-a',
      issue: { id: 'dom-1', detector: 'dom-bloat' },
      snapshot: { domNodeCount: 5000 },
      dispatchedAt: 10,
      receivedAt: expect.any(Number),
      suggestion: expect.stringContaining('DOM Bloat'),
    })
    expect(leases.acquire).toHaveBeenCalledWith('project-a')
  })

  it('does not let an owned bridge read another project', async () => {
    await leases.acquire('project-a')
    vi.mocked(client.listProjects).mockResolvedValue([project('project-a'), project('project-b')])
    const result = await call(context, 'get_performance_snapshot', { project_id: 'project-b' })
    expect(result.isError).toBe(true)
    expect(JSON.parse(result.text)).toMatchObject({ code: 'session-already-watching', projectId: 'project-a' })
    expect(client.getSnapshot).not.toHaveBeenCalled()
  })

  it('filters issues and performs project-scoped actions', async () => {
    const issues = await call(context, 'get_detected_issues', { severity: 'warning' })
    expect(JSON.parse(issues.text)).toMatchObject({ count: 1, issues: [{ id: 'dom-1' }] })
    await call(context, 'acknowledge_issue', { issue_id: 'dom-1' })
    const resolving = await call(context, 'resolve_issue', { issue_id: 'dom-1' })
    expect(JSON.parse(resolving.text)).toEqual({
      verifying: true,
      projectId: 'project-a',
      issue_id: 'dom-1',
    })
    expect(client.acknowledgeIssue).toHaveBeenCalledWith('project-a', 'dom-1')
    expect(client.resolveIssue).toHaveBeenCalledWith('project-a', 'dom-1')
  })

  it('releases the owned project', async () => {
    await leases.acquire('project-a')
    const result = await call(context, 'release_project')
    expect(JSON.parse(result.text)).toEqual({ released: true, projectId: 'project-a' })
    expect(leases.release).toHaveBeenCalledOnce()
  })
})
