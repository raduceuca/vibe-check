// Entry point for npx @wcgw/vibe-check-mcp

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createStore, updateSnapshot, type VibeStore } from './store.js'
import { createHttpServer } from './httpServer.js'
import { createMcpServer } from './mcpServer.js'
import type { VibeSnapshot } from './types.js'

const DEFAULT_PORT = 4200

const main = async (): Promise<void> => {
  const rawPort = parseInt(process.env['VIBE_CHECK_PORT'] ?? String(DEFAULT_PORT), 10)
  const port = Number.isNaN(rawPort) || rawPort < 1 || rawPort > 65535 ? DEFAULT_PORT : rawPort

  let store: VibeStore = createStore()

  const getStore = (): VibeStore => store
  const setStore = (newStore: VibeStore): void => { store = newStore }

  const httpContext = createHttpServer((snapshot: VibeSnapshot) => {
    store = updateSnapshot(store, snapshot)
  })

  const mcpContext = createMcpServer(getStore, setStore)

  httpContext.onSnapshot((snapshot) => {
    mcpContext.notifySnapshot(snapshot)
  })

  httpContext.server.listen(port, () => {
    process.stderr.write(`[vibe-check] HTTP server listening on port ${port}\n`)
  })

  const transport = new StdioServerTransport()
  await mcpContext.server.connect(transport)

  process.stderr.write('[vibe-check] MCP server connected via stdio\n')

  const shutdown = (): void => {
    process.stderr.write('[vibe-check] Shutting down...\n')
    httpContext.server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((error: unknown) => {
  process.stderr.write(`[vibe-check] Fatal error: ${error}\n`)
  process.exit(1)
})
