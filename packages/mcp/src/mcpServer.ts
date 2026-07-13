import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { DETECTOR_NAMES, SEVERITIES } from '@wcgw/vibe-check-protocol'
import type { HubClient } from './hubClient.js'
import { HubClientError } from './hubClient.js'
import type { LeaseManager } from './leaseManager.js'
import { getSuggestion } from './suggestions/index.js'

const projectIdSchema = z.string().optional().describe('Project ID from list_projects; optional when exactly one project is active')

const jsonResult = (payload: unknown, isError = false) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  ...(isError ? { isError: true } : {}),
})

const textResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
})

type ProjectResolution =
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false; readonly payload: unknown }

const resolveProject = async (
  client: HubClient,
  leases: LeaseManager,
  requested: string | undefined,
): Promise<ProjectResolution> => {
  const projects = await client.listProjects()
  const owned = leases.currentProjectId()
  if (owned && requested && requested !== owned) {
    return {
      ok: false,
      payload: {
        error: 'This agent is already watching another project',
        code: 'session-already-watching',
        projectId: owned,
      },
    }
  }
  if (owned) return { ok: true, projectId: owned }
  if (requested) {
    return projects.some((project) => project.projectId === requested)
      ? { ok: true, projectId: requested }
      : {
          ok: false,
          payload: { error: 'Project not found', code: 'project-not-found', projects },
        }
  }
  if (projects.length === 1) return { ok: true, projectId: projects[0]!.projectId }
  return {
    ok: false,
    payload: {
      error: projects.length === 0
        ? 'No active VibeCheck project. Open an app with the widget enabled.'
        : 'Multiple VibeCheck projects are active. Pass project_id.',
      code: projects.length === 0 ? 'no-projects' : 'project-ambiguous',
      projects,
    },
  }
}

const hubErrorPayload = (error: unknown): unknown => error instanceof HubClientError
  ? { error: error.message, code: error.code, details: error.body }
  : { error: error instanceof Error ? error.message : String(error), code: 'hub-request-failed' }

export interface McpServerContext {
  readonly server: McpServer
}

export const createMcpServer = (
  client: HubClient,
  leases: LeaseManager,
  version: string,
): McpServerContext => {
  const server = new McpServer({ name: 'vibe-check', version })

  const withProject = async <T>(
    requested: string | undefined,
    callback: (projectId: string) => Promise<T>,
  ): Promise<T | ReturnType<typeof jsonResult>> => {
    try {
      const resolution = await resolveProject(client, leases, requested)
      if (!resolution.ok) return jsonResult(resolution.payload, true)
      return await callback(resolution.projectId)
    } catch (error) {
      return jsonResult(hubErrorPayload(error), true)
    }
  }

  server.tool('list_projects', 'List active local VibeCheck projects and their agent state', {}, async () => {
    try {
      return jsonResult(await client.listProjects())
    } catch (error) {
      return jsonResult(hubErrorPayload(error), true)
    }
  })

  server.tool(
    'get_performance_snapshot',
    'Get the latest browser performance snapshot for one project',
    { project_id: projectIdSchema },
    async ({ project_id }) => withProject(project_id, async (projectId) => {
      const snapshot = await client.getSnapshot(projectId)
      return snapshot
        ? jsonResult(snapshot)
        : jsonResult({ error: 'No snapshot available yet.', code: 'no-snapshot', projectId }, true)
    }),
  )

  server.tool(
    'get_detected_issues',
    'Get active issues for one project, optionally filtered',
    {
      project_id: projectIdSchema,
      severity: z.enum([...SEVERITIES]).optional(),
      detector: z.enum([...DETECTOR_NAMES]).optional(),
    },
    async ({ project_id, severity, detector }) => withProject(project_id, async (projectId) => {
      const issues = await client.getDetectedIssues(projectId, { severity, detector })
      return jsonResult({ count: issues.length, issues })
    }),
  )

  server.tool(
    'get_fix_suggestions',
    'Get a fix suggestion for one detected issue',
    { project_id: projectIdSchema, issue_id: z.string() },
    async ({ project_id, issue_id }) => withProject(project_id, async (projectId) => {
      const issue = await client.getIssue(projectId, issue_id)
      return issue
        ? textResult(getSuggestion(issue))
        : jsonResult({ error: `Issue with id "${issue_id}" not found.`, code: 'issue-not-found', projectId }, true)
    }),
  )

  server.tool(
    'watch_performance',
    'Wait for the next snapshot for one project',
    {
      project_id: projectIdSchema,
      timeout_seconds: z.number().min(1).max(300).default(30),
    },
    async ({ project_id, timeout_seconds }) => withProject(project_id, async (projectId) => {
      const lease = await leases.acquire(projectId)
      if (!lease.ok) return jsonResult(lease, true)
      const snapshot = await client.waitForSnapshot(projectId, leases.sessionId, timeout_seconds)
      return snapshot
        ? jsonResult(snapshot)
        : jsonResult({ error: `No snapshot received within ${timeout_seconds} seconds`, code: 'watch-timeout', projectId }, true)
    }),
  )

  server.tool(
    'watch_for_issue',
    'Claim one project and wait for an issue explicitly sent from its widget',
    {
      project_id: projectIdSchema,
      timeout_seconds: z.number().min(1).max(300).default(30),
    },
    async ({ project_id, timeout_seconds }) => withProject(project_id, async (projectId) => {
      const lease = await leases.acquire(projectId)
      if (!lease.ok) return jsonResult(lease, true)
      const queued = await client.waitForIssue(projectId, leases.sessionId, timeout_seconds)
      if (!queued) {
        return jsonResult({ error: `No issue sent within ${timeout_seconds} seconds`, code: 'watch-timeout', projectId }, true)
      }
      return jsonResult({
        ...queued,
        suggestion: getSuggestion(queued.issue),
        receivedAt: Date.now(),
      })
    }),
  )

  server.tool(
    'acknowledge_issue',
    'Acknowledge an issue in one project',
    { project_id: projectIdSchema, issue_id: z.string() },
    async ({ project_id, issue_id }) => withProject(project_id, async (projectId) => {
      const issue = await client.getIssue(projectId, issue_id)
      if (!issue) return jsonResult({ error: `Issue with id "${issue_id}" not found.`, code: 'issue-not-found', projectId }, true)
      await client.acknowledgeIssue(projectId, issue_id)
      return jsonResult({ acknowledged: true, projectId, issue_id })
    }),
  )

  server.tool(
    'resolve_issue',
    'Request browser-evidence verification after fixing an issue in one project',
    { project_id: projectIdSchema, issue_id: z.string() },
    async ({ project_id, issue_id }) => withProject(project_id, async (projectId) => {
      const issue = await client.getIssue(projectId, issue_id)
      if (!issue) return jsonResult({ error: `Issue with id "${issue_id}" not found.`, code: 'issue-not-found', projectId }, true)
      await client.resolveIssue(projectId, issue_id)
      return jsonResult({ verifying: true, projectId, issue_id })
    }),
  )

  server.tool('release_project', 'Release this agent session\'s project lease', {}, async () => {
    const projectId = leases.currentProjectId()
    if (!projectId) return jsonResult({ released: false, code: 'no-project-lease' }, true)
    await leases.release()
    return jsonResult({ released: true, projectId })
  })

  return { server }
}
