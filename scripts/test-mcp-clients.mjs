import { execFile as execFileCallback, spawn } from 'node:child_process'
import { constants } from 'node:fs'
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const bridgeArgs = ['-y', '@wcgw/vibe-check-mcp', 'connect']
const commandTimeoutMs = 30_000
const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const localBridge = join(repositoryRoot, 'packages/mcp/dist/index.js')

const findExecutable = async (name) => {
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue
    const candidate = join(directory, name)
    try {
      await access(candidate, constants.X_OK)
      return candidate
    } catch {
      // Continue looking through PATH.
    }
  }
  return null
}

const run = async (executable, args, options = {}) => {
  const result = await execFile(executable, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    timeout: commandTimeoutMs,
    maxBuffer: 1024 * 1024,
  })
  return `${result.stdout}${result.stderr}`
}

const getVersion = async (executable) => {
  const output = await run(executable, ['--version'])
  return output.trim().split('\n')[0] || 'version-unknown'
}

const requireFragments = (output, fragments) => {
  const missing = fragments.find((fragment) => !output.includes(fragment))
  if (missing) {
    const excerpt = output.replace(/\s+/g, ' ').trim().slice(0, 300)
    throw new Error(`verification output omitted ${JSON.stringify(missing)}: ${excerpt}`)
  }
}

const errorReason = (error) => {
  if (!(error instanceof Error)) return String(error)
  const detail = 'stderr' in error && typeof error.stderr === 'string' && error.stderr.trim()
    ? error.stderr.trim()
    : error.message
  return detail.replace(/\s+/g, ' ').slice(0, 240)
}

const findAvailablePort = async () => await new Promise((resolve, reject) => {
  const server = createServer()
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      reject(new Error('Could not allocate a local test port'))
      return
    }
    server.close((error) => error ? reject(error) : resolve(address.port))
  })
})

const startLocalHub = async () => {
  await access(localBridge, constants.X_OK)
  const port = await findAvailablePort()
  const url = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, [localBridge, 'hub'], {
    env: { ...process.env, VIBE_CHECK_HOST: '127.0.0.1', VIBE_CHECK_PORT: String(port) },
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr?.on('data', (chunk) => { stderr += String(chunk) })

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`local hub exited early: ${stderr.trim()}`)
    try {
      const response = await fetch(`${url}/api/health`)
      if (response.ok) return { child, url }
    } catch {
      // The hub is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  child.kill('SIGTERM')
  throw new Error(`local hub did not become ready: ${stderr.trim()}`)
}

const stopLocalHub = async (child) => {
  if (child.exitCode != null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (child.exitCode == null) child.kill('SIGKILL')
}

const checkCodex = async (root) => {
  const executable = await findExecutable('codex')
  if (!executable) return { client: 'Codex', status: 'SKIP', detail: 'install Codex CLI, then run codex mcp get vibe-check --json' }

  const home = join(root, 'codex-home')
  await mkdir(home, { recursive: true })
  const env = { CODEX_HOME: home }
  await run(executable, ['mcp', 'add', 'vibe-check', '--', 'npx', ...bridgeArgs], { env })
  const configured = await run(executable, ['mcp', 'get', 'vibe-check', '--json'], { env })
  requireFragments(configured, ['vibe-check', 'npx', '@wcgw/vibe-check-mcp', 'connect'])
  return { client: 'Codex', status: 'PASS', detail: await getVersion(executable) }
}

const checkClaude = async (root) => {
  const executable = await findExecutable('claude')
  if (!executable) return { client: 'Claude Code', status: 'SKIP', detail: 'install Claude Code, then run claude mcp get vibe-check' }

  const home = join(root, 'claude-home')
  const config = join(root, 'claude-config')
  const project = join(root, 'claude-project')
  await Promise.all([mkdir(home, { recursive: true }), mkdir(config, { recursive: true }), mkdir(project, { recursive: true })])
  const env = { HOME: home, CLAUDE_CONFIG_DIR: config }
  await run(executable, ['mcp', 'add', '--scope', 'local', 'vibe-check', '--', 'npx', ...bridgeArgs], { cwd: project, env })
  const configured = await run(executable, ['mcp', 'get', 'vibe-check'], { cwd: project, env })
  requireFragments(configured, ['vibe-check', 'npx', '@wcgw/vibe-check-mcp', 'connect'])
  return { client: 'Claude Code', status: 'PASS', detail: await getVersion(executable) }
}

const checkCursor = async (root, hubUrl) => {
  const executable = await findExecutable('cursor-agent')
  if (!executable) return { client: 'Cursor', status: 'SKIP', detail: 'install Cursor Agent, then run cursor-agent mcp list-tools vibe-check' }

  const home = join(root, 'cursor-home')
  const project = join(root, 'cursor-project')
  const cursorDirectory = join(project, '.cursor')
  await Promise.all([mkdir(home, { recursive: true }), mkdir(cursorDirectory, { recursive: true })])
  await writeFile(join(cursorDirectory, 'mcp.json'), `${JSON.stringify({
    mcpServers: {
      'vibe-check': { command: 'npx', args: bridgeArgs },
      'vibe-check-under-test': {
        command: process.execPath,
        args: [localBridge, 'connect'],
        env: { VIBE_CHECK_HUB_URL: hubUrl },
      },
    },
  }, null, 2)}\n`)
  const env = { HOME: home }
  const configured = await run(executable, ['mcp', 'list'], { cwd: project, env })
  requireFragments(configured, ['vibe-check', 'vibe-check-under-test'])
  await run(executable, ['mcp', 'enable', 'vibe-check-under-test'], { cwd: project, env })
  const tools = await run(executable, ['mcp', 'list-tools', 'vibe-check-under-test'], { cwd: project, env })
  requireFragments(tools, ['list_projects', 'watch_for_issue'])
  return { client: 'Cursor', status: 'PASS', detail: await getVersion(executable) }
}

const main = async () => {
  const root = await mkdtemp(join(tmpdir(), 'vibe-check-clients-'))
  const checks = [checkCodex, checkClaude]
  const results = []
  let hub = null
  try {
    for (const check of checks) {
      try {
        results.push(await check(root))
      } catch (error) {
        const client = check === checkCodex ? 'Codex' : 'Claude Code'
        results.push({ client, status: 'FAIL', detail: errorReason(error) })
      }
    }
    try {
      hub = await startLocalHub()
      results.push(await checkCursor(root, hub.url))
    } catch (error) {
      results.push({ client: 'Cursor', status: 'FAIL', detail: errorReason(error) })
    }
  } finally {
    if (hub) await stopLocalHub(hub.child)
    await rm(root, { recursive: true, force: true })
  }

  for (const result of results) console.log(`${result.status} ${result.client} ${result.detail}`)
  if (results.some((result) => result.status === 'FAIL')) process.exitCode = 1
}

await main()
