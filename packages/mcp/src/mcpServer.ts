import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getSuggestion } from './suggestions/index.js'
import { acknowledgeIssue, resolveIssue, type VibeStore } from './store.js'
import type { VibeIssue, VibeSnapshot } from './types.js'

const VERSION = '0.1.0'

type SnapshotWaiter = (snapshot: VibeSnapshot) => void

const findIssueById = (store: VibeStore, id: string): VibeIssue | undefined => {
  const allIssues = [
    ...(store.latestSnapshot?.issues ?? []),
    ...store.issueHistory,
  ]
  return allIssues.find((i) => i.id === id)
}

export interface McpServerContext {
  readonly server: McpServer
  readonly notifySnapshot: (snapshot: VibeSnapshot) => void
}

export const createMcpServer = (
  getStore: () => VibeStore,
  setStore: (store: VibeStore) => void,
): McpServerContext => {
  const server = new McpServer({
    name: 'vibe-check',
    version: VERSION,
  })

  const snapshotWaiters = new Set<SnapshotWaiter>()

  const notifySnapshot = (snapshot: VibeSnapshot): void => {
    for (const waiter of snapshotWaiters) {
      waiter(snapshot)
    }
    snapshotWaiters.clear()
  }

  server.tool(
    'get_performance_snapshot',
    'Get the latest browser performance snapshot including frame rate, web vitals, memory, resources, and detected issues',
    {},
    async () => {
      const store = getStore()

      if (!store.latestSnapshot) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No snapshot available yet. The browser widget has not sent any data.' }) }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(store.latestSnapshot, null, 2) }],
      }
    },
  )

  server.tool(
    'get_detected_issues',
    'Get active (not resolved or acknowledged) performance issues. Optionally filter by severity or detector name.',
    {
      severity: z.enum(['info', 'warning', 'error', 'critical']).optional().describe('Filter by severity level'),
      detector: z.string().optional().describe('Filter by detector name (e.g., dom-bloat, memory-leak)'),
    },
    async ({ severity, detector }) => {
      const store = getStore()
      const snapshot = store.latestSnapshot

      if (!snapshot) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: 'No snapshot available yet.' }) }],
        }
      }

      const activeIssues = snapshot.issues.filter((issue) => {
        if (store.acknowledgedIds.has(issue.id)) return false
        if (store.resolvedIds.has(issue.id)) return false
        if (severity && issue.severity !== severity) return false
        if (detector && issue.detector !== detector) return false
        return true
      })

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: activeIssues.length, issues: activeIssues }, null, 2) }],
      }
    },
  )

  server.tool(
    'get_fix_suggestions',
    'Get detailed fix suggestions for a specific performance issue, including step-by-step instructions and code examples',
    {
      issue_id: z.string().describe('The ID of the issue to get suggestions for'),
    },
    async ({ issue_id }) => {
      const store = getStore()
      const issue = findIssueById(store, issue_id)

      if (!issue) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Issue with id "${issue_id}" not found.` }) }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: getSuggestion(issue) }],
      }
    },
  )

  server.tool(
    'watch_performance',
    'Wait for the next browser performance snapshot update and return it. Useful for monitoring changes after a fix.',
    {
      timeout_seconds: z.number().min(1).max(300).default(30).describe('How long to wait for a new snapshot (1-300, default: 30)'),
    },
    async ({ timeout_seconds }) => {
      const timeoutMs = timeout_seconds * 1000

      let waiterResolve: SnapshotWaiter | null = null

      const result = await Promise.race([
        new Promise<VibeSnapshot>((resolve) => {
          waiterResolve = resolve
          snapshotWaiters.add(resolve)
        }),
        new Promise<null>((_, reject) => {
          setTimeout(() => {
            if (waiterResolve) {
              snapshotWaiters.delete(waiterResolve)
            }
            reject(new Error(`No snapshot received within ${timeout_seconds} seconds`))
          }, timeoutMs)
        }),
      ]).catch((error: Error) => {
        return { error: error.message }
      })

      if (result !== null && 'error' in result) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    },
  )

  server.tool(
    'acknowledge_issue',
    'Mark a performance issue as acknowledged. Acknowledged issues will not appear in get_detected_issues.',
    {
      issue_id: z.string().describe('The ID of the issue to acknowledge'),
    },
    async ({ issue_id }) => {
      const store = getStore()
      const issue = findIssueById(store, issue_id)

      if (!issue) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Issue with id "${issue_id}" not found.` }) }],
        }
      }

      setStore(acknowledgeIssue(store, issue_id))

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ acknowledged: true, issue_id }) }],
      }
    },
  )

  server.tool(
    'resolve_issue',
    'Mark a performance issue as resolved. Resolved issues will not appear in get_detected_issues.',
    {
      issue_id: z.string().describe('The ID of the issue to resolve'),
    },
    async ({ issue_id }) => {
      const store = getStore()
      const issue = findIssueById(store, issue_id)

      if (!issue) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Issue with id "${issue_id}" not found.` }) }],
        }
      }

      setStore(resolveIssue(store, issue_id))

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ resolved: true, issue_id }) }],
      }
    },
  )

  return { server, notifySnapshot }
}
