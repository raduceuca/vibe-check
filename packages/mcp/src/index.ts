import { randomUUID } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHubClient } from './hubClient.js'
import { createHubServer } from './hubServer.js'
import { createLeaseManager } from './leaseManager.js'
import { exitOnFatalError } from './fatal.js'
import { runMain } from './main.js'
import { createMcpServer } from './mcpServer.js'

declare const __VIBE_CHECK_VERSION__: string

const main = async (): Promise<void> => {
  const result = await runMain(process.argv.slice(2), process.env, {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  }, {
    cwd: process.cwd(),
    version: __VIBE_CHECK_VERSION__,
  })
  if (result.kind === 'exit') {
    process.exitCode = result.code
    return
  }
  const { config } = result

  if (config.role === 'hub') {
    const hub = createHubServer({ version: __VIBE_CHECK_VERSION__ })
    hub.server.listen(config.port, config.host, () => {
      process.stderr.write(`[vibe-check] Hub listening on http://${config.host}:${config.port}\n`)
    })
    const shutdown = async (): Promise<void> => {
      await hub.close()
      process.exit(0)
    }
    process.on('SIGINT', () => { void shutdown() })
    process.on('SIGTERM', () => { void shutdown() })
    return
  }

  const client = createHubClient(config.hubUrl)
  await client.health()
  const leases = createLeaseManager(client, randomUUID())
  const mcp = createMcpServer(client, leases, __VIBE_CHECK_VERSION__)
  await mcp.server.connect(new StdioServerTransport())
  process.stderr.write(`[vibe-check] MCP bridge connected to ${config.hubUrl}\n`)

  let shuttingDown = false
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    await leases.stop()
    await mcp.server.close()
    process.exit(0)
  }
  process.on('SIGINT', () => { void shutdown() })
  process.on('SIGTERM', () => { void shutdown() })
  process.stdin.on('close', () => { void shutdown() })
}

main().catch(exitOnFatalError)
