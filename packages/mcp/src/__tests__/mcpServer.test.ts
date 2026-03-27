import { describe, it, expect, beforeEach } from 'vitest'
import { createMcpServer } from '../mcpServer.js'
import { createStore, updateSnapshot, type VibeStore } from '../store.js'
import type { VibeIssue, VibeSnapshot } from '../types.js'

const makeIssue = (overrides: Partial<VibeIssue> = {}): VibeIssue => ({
  id: `issue-${Math.random().toString(36).slice(2, 8)}`,
  detector: 'dom-bloat',
  severity: 'warning',
  title: 'Test Issue',
  description: 'A test issue',
  evidence: { nodeCount: 5000 },
  timestamp: Date.now(),
  acknowledged: false,
  resolved: false,
  ...overrides,
})

const makeSnapshot = (overrides: Partial<VibeSnapshot> = {}): VibeSnapshot => ({
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.67, maxFrameTime: 20, droppedFrames: 0, smoothness: 1 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 100, jsTransferKB: 50, cssTransferKB: 20, imageTransferKB: 20, fontTransferKB: 10, resourceCount: 5, largeResources: [] },
  issues: [],
  domNodeCount: 500,
  ...overrides,
})

/**
 * Extract tool handlers from the MCP server by accessing its internal registry.
 * This avoids needing to spin up a full MCP transport for unit tests.
 * The SDK stores tools as a plain object keyed by tool name, with a `handler` function.
 */
const getToolHandler = (server: ReturnType<typeof createMcpServer>['server'], toolName: string) => {
  const registeredTools = (server as unknown as Record<string, Record<string, { handler: (args: Record<string, unknown>) => Promise<unknown> }>>)['_registeredTools']

  if (!registeredTools) {
    throw new Error('Cannot access _registeredTools on McpServer')
  }

  const tool = registeredTools[toolName]
  if (!tool) {
    throw new Error(`Tool "${toolName}" not found`)
  }

  return tool.handler
}

describe('mcpServer', () => {
  let store: VibeStore
  let getStore: () => VibeStore
  let setStore: (s: VibeStore) => void
  let mcpContext: ReturnType<typeof createMcpServer>

  beforeEach(() => {
    store = createStore()
    getStore = () => store
    setStore = (s: VibeStore) => { store = s }
    mcpContext = createMcpServer(getStore, setStore)
  })

  describe('get_performance_snapshot', () => {
    it('returns error when no snapshot available', async () => {
      const handler = getToolHandler(mcpContext.server, 'get_performance_snapshot')

      const result = await handler({}) as { content: Array<{ text: string }> }
      const text = result.content[0]!.text
      const parsed = JSON.parse(text) as Record<string, string>

      expect(parsed['error']).toContain('No snapshot available')
    })

    it('returns latest snapshot when available', async () => {
      const snapshot = makeSnapshot({ domNodeCount: 1234 })
      store = updateSnapshot(store, snapshot)

      const handler = getToolHandler(mcpContext.server, 'get_performance_snapshot')
      const result = await handler({}) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as VibeSnapshot

      expect(parsed.domNodeCount).toBe(1234)
    })
  })

  describe('get_detected_issues', () => {
    it('returns active issues excluding acknowledged and resolved', async () => {
      const issue1 = makeIssue({ id: 'active-1', severity: 'warning' })
      const issue2 = makeIssue({ id: 'acked-1', severity: 'error' })
      const issue3 = makeIssue({ id: 'resolved-1', severity: 'critical' })
      const snapshot = makeSnapshot({ issues: [issue1, issue2, issue3] })

      store = updateSnapshot(store, snapshot)
      store = { ...store, acknowledgedIds: new Set(['acked-1']) }
      store = { ...store, resolvedIds: new Set(['resolved-1']) }

      const handler = getToolHandler(mcpContext.server, 'get_detected_issues')
      const result = await handler({}) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as { count: number; issues: VibeIssue[] }

      expect(parsed.count).toBe(1)
      expect(parsed.issues[0]!.id).toBe('active-1')
    })

    it('filters by severity', async () => {
      const issue1 = makeIssue({ id: 'warn-1', severity: 'warning' })
      const issue2 = makeIssue({ id: 'err-1', severity: 'error' })
      const snapshot = makeSnapshot({ issues: [issue1, issue2] })
      store = updateSnapshot(store, snapshot)

      const handler = getToolHandler(mcpContext.server, 'get_detected_issues')
      const result = await handler({ severity: 'error' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as { count: number; issues: VibeIssue[] }

      expect(parsed.count).toBe(1)
      expect(parsed.issues[0]!.id).toBe('err-1')
    })

    it('filters by detector', async () => {
      const issue1 = makeIssue({ id: 'dom-1', detector: 'dom-bloat' })
      const issue2 = makeIssue({ id: 'mem-1', detector: 'memory-leak' })
      const snapshot = makeSnapshot({ issues: [issue1, issue2] })
      store = updateSnapshot(store, snapshot)

      const handler = getToolHandler(mcpContext.server, 'get_detected_issues')
      const result = await handler({ detector: 'memory-leak' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as { count: number; issues: VibeIssue[] }

      expect(parsed.count).toBe(1)
      expect(parsed.issues[0]!.id).toBe('mem-1')
    })
  })

  describe('get_fix_suggestions', () => {
    it('returns suggestion for a known issue', async () => {
      const issue = makeIssue({ id: 'dom-issue-1', detector: 'dom-bloat', evidence: { nodeCount: 5000 } })
      const snapshot = makeSnapshot({ issues: [issue] })
      store = updateSnapshot(store, snapshot)

      const handler = getToolHandler(mcpContext.server, 'get_fix_suggestions')
      const result = await handler({ issue_id: 'dom-issue-1' }) as { content: Array<{ text: string }> }

      expect(result.content[0]!.text).toContain('DOM Bloat')
      expect(result.content[0]!.text).toContain('5000')
    })

    it('returns error for unknown issue id', async () => {
      const handler = getToolHandler(mcpContext.server, 'get_fix_suggestions')
      const result = await handler({ issue_id: 'nonexistent' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as Record<string, string>

      expect(parsed['error']).toContain('nonexistent')
    })
  })

  describe('acknowledge_issue', () => {
    it('marks issue as acknowledged in the store', async () => {
      const issue = makeIssue({ id: 'ack-me' })
      const snapshot = makeSnapshot({ issues: [issue] })
      store = updateSnapshot(store, snapshot)

      const handler = getToolHandler(mcpContext.server, 'acknowledge_issue')
      const result = await handler({ issue_id: 'ack-me' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as Record<string, unknown>

      expect(parsed['acknowledged']).toBe(true)
      expect(store.acknowledgedIds.has('ack-me')).toBe(true)
    })

    it('returns error for unknown issue id', async () => {
      const handler = getToolHandler(mcpContext.server, 'acknowledge_issue')
      const result = await handler({ issue_id: 'ghost' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as Record<string, string>

      expect(parsed['error']).toContain('ghost')
    })
  })

  describe('resolve_issue', () => {
    it('marks issue as resolved in the store', async () => {
      const issue = makeIssue({ id: 'resolve-me' })
      const snapshot = makeSnapshot({ issues: [issue] })
      store = updateSnapshot(store, snapshot)

      const handler = getToolHandler(mcpContext.server, 'resolve_issue')
      const result = await handler({ issue_id: 'resolve-me' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as Record<string, unknown>

      expect(parsed['resolved']).toBe(true)
      expect(store.resolvedIds.has('resolve-me')).toBe(true)
    })

    it('returns error for unknown issue id', async () => {
      const handler = getToolHandler(mcpContext.server, 'resolve_issue')
      const result = await handler({ issue_id: 'ghost' }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as Record<string, string>

      expect(parsed['error']).toContain('ghost')
    })
  })

  describe('watch_performance', () => {
    it('resolves when a snapshot is received', async () => {
      const handler = getToolHandler(mcpContext.server, 'watch_performance')

      const resultPromise = handler({ timeout_seconds: 5 }) as Promise<{ content: Array<{ text: string }> }>

      // Simulate a snapshot arriving after a short delay
      setTimeout(() => {
        mcpContext.notifySnapshot(makeSnapshot({ domNodeCount: 9999 }))
      }, 50)

      const result = await resultPromise
      const parsed = JSON.parse(result.content[0]!.text) as VibeSnapshot

      expect(parsed.domNodeCount).toBe(9999)
    })

    it('returns error on timeout', async () => {
      const handler = getToolHandler(mcpContext.server, 'watch_performance')

      const result = await handler({ timeout_seconds: 0.1 }) as { content: Array<{ text: string }> }
      const parsed = JSON.parse(result.content[0]!.text) as Record<string, string>

      expect(parsed['error']).toContain('No snapshot received')
    })
  })
})
