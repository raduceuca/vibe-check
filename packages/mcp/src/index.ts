import { randomUUID } from 'node:crypto'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createHubClient } from './hubClient.js'
import { createHubServer } from './hubServer.js'
import { createLeaseManager } from './leaseManager.js'
import { exitOnFatalError } from './fatal.js'
import { runMain } from './main.js'
import { createMcpServer } from './mcpServer.js'
import { formatSetupPack, getAgentClientSetup, getWatchInstruction, type AgentClientId } from '@wcgw/vibe-check-protocol'

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

  if (config.role === 'hub' || config.role === 'up') {
    const hub = createHubServer({
      version: __VIBE_CHECK_VERSION__,
      registryPath: config.registryPath,
      onPersistenceWarning: (message) => process.stderr.write(`[vibe-check] ${message}\n`),
    })
    hub.server.listen(config.port, config.host, () => {
      const base = `http://${config.host}:${config.port}`
      process.stderr.write(`[vibe-check] Hub listening on ${base}\n`)
      if (config.role === 'up') {
        const projectId = config.projectId ?? 'my-project'
        const agent = (config.agent ?? 'codex') as AgentClientId
        process.stderr.write(`[vibe-check] Guided setup for project "${projectId}" (${getAgentClientSetup(agent).label})\n`)
        process.stderr.write(`${formatSetupPack({ projectId, agent, preferUp: false })}\n`)
        process.stderr.write(`[vibe-check] Doctor (read-only): npx -y @wcgw/vibe-check-mcp@${__VIBE_CHECK_VERSION__} doctor --project ${projectId}\n`)
        process.stderr.write(`[vibe-check] After the agent is watching, click Send to agent in the widget.\n`)
        process.stderr.write(`[vibe-check] Watch instruction: ${getWatchInstruction(projectId)}\n`)
      }
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
