import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  MCP_TOOL_CATALOG,
  MAX_WATCH_WAIT_SECONDS,
  type McpToolDescriptor,
  type McpToolParam,
} from '@wcgw/vibe-check-protocol'
import type { HubClient } from './hubClient.js'
import { HubClientError } from './hubClient.js'
import type { LeaseManager } from './leaseManager.js'
import { getSuggestion } from './suggestions/index.js'
import type { IssueActionResult, IssueVerificationStatus } from './types.js'

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
    // Explicit project_id: allow inactive (registered) projects for impact reads.
    return { ok: true, projectId: requested }
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

const hubErrorPayload = (error: unknown): unknown => {
  if (error instanceof HubClientError) {
    return { error: error.message, code: error.code, details: error.body }
  }
  return { error: error instanceof Error ? error.message : String(error), code: 'hub-request-failed' }
}

const leaseErrorPayload = (lease: { ok: false; code: string; projectId?: string; message?: string; holder?: unknown }) => ({
  error: lease.message
    ?? (lease.code === 'lease-conflict'
      ? 'Another agent session already holds this project.'
      : `Could not claim project (${lease.code}).`),
  code: lease.code,
  projectId: lease.projectId,
  ...(lease.holder ? { holder: lease.holder } : {}),
  retry: false,
})

const secondsLabel = (seconds: number): string =>
  `${seconds} second${seconds === 1 ? '' : 's'}`

const zodForParam = (param: McpToolParam): z.ZodTypeAny => {
  switch (param.kind) {
    case 'string':
      return param.required ? z.string() : z.string().optional()
    case 'number': {
      const base = z.number().min(param.min).max(param.max)
      return param.required ? base : base.default(param.default)
    }
    case 'enum': {
      const values = param.values as [string, ...string[]]
      const base = z.enum(values)
      return param.required ? base : base.optional()
    }
  }
}

const schemaFor = (descriptor: McpToolDescriptor): Record<string, z.ZodTypeAny> => {
  const schema: Record<string, z.ZodTypeAny> = {}
  for (const param of descriptor.params) {
    schema[param.name] = zodForParam(param).describe(param.description)
  }
  return schema
}

const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'))
    }, { once: true })
  })

const verificationMessage = (verification: IssueVerificationStatus | null): string => {
  if (verification === null) return 'Verification status is not available yet.'
  if (verification.outcome === 'fixed') {
    return 'Browser evidence shows the issue is gone. Marked fixed.'
  }
  if (verification.outcome === 'still-present') {
    return 'Browser evidence still shows the issue. Keep working on it.'
  }
  if (verification.outcome === 'not-requested') {
    return 'Verification has not been requested for this issue.'
  }
  if (verification.waitingFor === 'no-snapshot-yet') {
    return 'Waiting for a fresh browser snapshot to verify the fix.'
  }
  if (verification.waitingFor) {
    return `Still verifying (waiting for: ${verification.waitingFor}).`
  }
  return `Verification pending (${verification.cleanSnapshots}/${verification.requiredCleanSnapshots} clean snapshots).`
}

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

  const claim = async (projectId: string) => {
    const lease = await leases.acquire(projectId)
    if (!lease.ok) return { ok: false as const, result: jsonResult(leaseErrorPayload(lease), true) }
    return { ok: true as const }
  }

  type ToolExtra = { signal?: AbortSignal }
  type ToolResult = ReturnType<typeof jsonResult> | ReturnType<typeof textResult>

  const handlers: Record<string, (args: Record<string, unknown>, extra: ToolExtra) => Promise<ToolResult>> = {
    list_projects: async () => {
      try {
        return jsonResult(await client.listProjects())
      } catch (error) {
        return jsonResult(hubErrorPayload(error), true)
      }
    },

    get_project_impact: async ({ project_id }) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const impact = await client.getProjectImpact(projectId)
        return impact
          ? jsonResult(impact)
          : jsonResult({ error: 'Project impact not found', code: 'project-not-found', projectId }, true)
      },
    ),

    get_performance_snapshot: async ({ project_id }) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const snapshot = await client.getSnapshot(projectId)
        return snapshot
          ? jsonResult(snapshot)
          : jsonResult({ error: 'No snapshot available yet.', code: 'no-snapshot', projectId }, true)
      },
    ),

    get_detected_issues: async ({ project_id, severity, detector }) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const issues = await client.getDetectedIssues(projectId, {
          severity: typeof severity === 'string' ? severity as never : undefined,
          detector: typeof detector === 'string' ? detector as never : undefined,
        })
        return jsonResult({ count: issues.length, issues })
      },
    ),

    get_fix_suggestions: async ({ project_id, issue_id }) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const issueId = String(issue_id ?? '')
        const issue = await client.getIssue(projectId, issueId)
        return issue
          ? textResult(getSuggestion(issue))
          : jsonResult({ error: `Issue with id "${issueId}" not found.`, code: 'issue-not-found', projectId }, true)
      },
    ),

    watch_performance: async ({ project_id, timeout_seconds }, extra) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const claimed = await claim(projectId)
        if (!claimed.ok) return claimed.result
        const timeout = typeof timeout_seconds === 'number' ? timeout_seconds : 30
        const capped = Math.min(timeout, MAX_WATCH_WAIT_SECONDS)
        try {
          const snapshot = await client.waitForSnapshot(
            projectId,
            leases.sessionId,
            capped,
            extra.signal,
          )
          return snapshot
            ? jsonResult(snapshot)
            : jsonResult({
              error: `No snapshot received within ${secondsLabel(capped)}. Call watch_performance again to keep waiting.`,
              code: 'watch-timeout',
              projectId,
              retry: true,
            }, true)
        } catch (error) {
          if (extra.signal?.aborted) {
            return jsonResult({
              error: 'watch_performance was cancelled.',
              code: 'watch-cancelled',
              projectId,
              retry: true,
            }, true)
          }
          throw error
        }
      },
    ),

    watch_for_issue: async ({ project_id, timeout_seconds }, extra) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const claimed = await claim(projectId)
        if (!claimed.ok) return claimed.result
        const timeout = typeof timeout_seconds === 'number' ? timeout_seconds : 30
        const capped = Math.min(timeout, MAX_WATCH_WAIT_SECONDS)
        let queued
        try {
          queued = await client.waitForIssue(projectId, leases.sessionId, capped, extra.signal)
        } catch (error) {
          if (extra.signal?.aborted) {
            return jsonResult({
              error: 'watch_for_issue was cancelled. Any in-flight dispatch stays queued.',
              code: 'watch-cancelled',
              projectId,
              retry: true,
            }, true)
          }
          throw error
        }
        if (!queued) {
          return jsonResult({
            error: `No issue was sent in the last ${secondsLabel(capped)}. Call watch_for_issue again to keep waiting.`,
            code: 'watch-timeout',
            projectId,
            retry: true,
          }, true)
        }
        if (extra.signal?.aborted) {
          if (queued.deliveryId) {
            await client.returnDelivery(projectId, leases.sessionId, queued.deliveryId)
          }
          return jsonResult({
            error: 'watch_for_issue was cancelled before the delivery was acknowledged.',
            code: 'watch-cancelled',
            projectId,
            retry: true,
          }, true)
        }
        if (queued.deliveryId) {
          const receipt = await client.confirmDelivery(
            projectId,
            leases.sessionId,
            queued.deliveryId,
          )
          if (!receipt.ok) {
            return jsonResult({
              error: 'This delivery expired before it reached you. Call watch_for_issue again; the issue is still queued.',
              code: receipt.code,
              projectId,
              deliveryId: queued.deliveryId,
              retry: true,
            }, true)
          }
        }
        return jsonResult({
          ...queued,
          suggestion: getSuggestion(queued.issue),
          receivedAt: Date.now(),
        })
      },
    ),

    acknowledge_issue: async ({ project_id, issue_id }) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const claimed = await claim(projectId)
        if (!claimed.ok) return claimed.result
        const issueId = String(issue_id ?? '')
        const result = await client.acknowledgeIssue(projectId, leases.sessionId, issueId)
        return jsonResult({
          ...result,
          issue_id: issueId,
        }, !result.ok)
      },
    ),

    resolve_issue: async ({ project_id, issue_id, wait_seconds }, extra) => withProject(
      typeof project_id === 'string' ? project_id : undefined,
      async (projectId) => {
        const claimed = await claim(projectId)
        if (!claimed.ok) return claimed.result
        const issueId = String(issue_id ?? '')
        const waitSeconds = typeof wait_seconds === 'number'
          ? Math.min(Math.max(0, Math.floor(wait_seconds)), MAX_WATCH_WAIT_SECONDS)
          : 0
        const action = await client.resolveIssue(projectId, leases.sessionId, issueId)
        if (!action.ok) {
          return jsonResult({ ...action, issue_id: issueId }, true)
        }

        let verification = await client.getVerificationStatus(projectId, issueId)
        const deadline = Date.now() + waitSeconds * 1_000
        while (
          waitSeconds > 0
          && verification?.outcome === 'pending'
          && Date.now() < deadline
          && !extra.signal?.aborted
        ) {
          await sleep(1_000, extra.signal).catch(() => undefined)
          verification = await client.getVerificationStatus(projectId, issueId)
        }

        const payload: IssueActionResult & {
          readonly issue_id: string
          readonly verification: IssueVerificationStatus | null
          readonly message: string
        } = {
          ...action,
          issue_id: issueId,
          verification,
          message: verificationMessage(verification),
        }
        return jsonResult(payload)
      },
    ),

    release_project: async () => {
      const projectId = leases.currentProjectId()
      if (!projectId) return jsonResult({ released: false, code: 'no-project-lease' }, true)
      await leases.release()
      return jsonResult({ released: true, projectId })
    },
  }

  for (const descriptor of MCP_TOOL_CATALOG) {
    const handler = handlers[descriptor.name]
    if (!handler) throw new Error(`Missing handler for MCP tool ${descriptor.name}`)
    const run = handler
    server.tool(
      descriptor.name,
      descriptor.description,
      schemaFor(descriptor),
      async (args, extra): Promise<ToolResult> => run(args as Record<string, unknown>, extra ?? {}),
    )
  }

  return { server }
}
