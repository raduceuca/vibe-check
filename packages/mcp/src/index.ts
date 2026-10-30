import { randomUUID } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHubClient } from './hubClient.js'
import { createLeaseManager } from './leaseManager.js'
import { exitOnFatalError } from './fatal.js'
import { ensureHubReachable, runMain, startHub } from './main.js'
import { createMcpServer } from './mcpServer.js'

declare const __VIBE_CHECK_VERSION__: string

const io = {
  stdout: (value: string) => { process.stdout.write(value) },
  stderr: (value: string) => { process.stderr.write(value) },
}

const main = async (): Promise<void> => {
  const result = await runMain(process.argv.slice(2), process.env, io, {
    cwd: process.cwd(),
    version: __VIBE_CHECK_VERSION__,
  })
  if (result.kind === 'exit') {
    process.exitCode = result.code
    return
  }
  const { config } = result

  if (config.role === 'hub' || config.role === 'up') {
    const started = await startHub(config, io, { version: __VIBE_CHECK_VERSION__ })
    if (started.kind === 'exit') {
      process.exitCode = started.code
      return
    }
    const shutdown = async (): Promise<void> => {
      await started.hub.close()
      process.exit(0)
    }
    process.on('SIGINT', () => { void shutdown() })
    process.on('SIGTERM', () => { void shutdown() })
    return
  }

  const client = createHubClient(config.hubUrl)
  await ensureHubReachable(config.hubUrl, client)
  // The SDK fills getClientVersion after the client initializes; lease acquire
  // reads it lazily so lease-conflict messages can name the holder.
  let mcpRef: ReturnType<typeof createMcpServer> | null = null
  const leases = createLeaseManager(client, randomUUID(), () =>
    mcpRef?.server.server.getClientVersion()?.name ?? null)
  const mcp = createMcpServer(client, leases, __VIBE_CHECK_VERSION__)
  mcpRef = mcp
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
