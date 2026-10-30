import { createServer as createHttpServer, type Server } from 'node:http'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { HUB_START_COMMAND } from '@wcgw/vibe-check-protocol'
import {
  ensureHubReachable,
  formatUpBanner,
  hubUrlFor,
  probeVibeCheckHub,
  runMain,
  startHub,
  type StartHubServerOptions,
  type UpRunConfig,
} from '../main.js'
import { createHubServer, type HubServerContext } from '../hubServer.js'
import { HubClientError, type HubClient } from '../hubClient.js'
import { CliError } from '../fatal.js'
import { readProjectRegistry, registerProjectRoot } from '../projectRegistry.js'
import type { ProjectSnapshotEnvelope, VibeSnapshot } from '../types.js'

const snapshot: VibeSnapshot = {
  timestamp: Date.now(),
  frameRate: { fps: 60, avgFrameTime: 16.7, maxFrameTime: 20, droppedFrames: 0, smoothness: 100 },
  longFrames: { count: 0, entries: [], worstFrame: 0 },
  webVitals: { lcp: null, inp: null, cls: null },
  memory: null,
  resources: { totalTransferKB: 0, jsTransferKB: 0, cssTransferKB: 0, imageTransferKB: 0, fontTransferKB: 0, resourceCount: 0, largeResources: [] },
  console: { logCount: 0, warnCount: 0, errorCount: 0, totalCount: 0 },
  issues: [],
  domNodeCount: 10,
}

const cleanups: (() => Promise<void>)[] = []

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup()
})

const listenOnFreePort = async (server: Server): Promise<number> => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return typeof address === 'object' && address ? address.port : 0
}

const freePort = async (): Promise<number> => {
  const server = createHttpServer()
  const port = await listenOnFreePort(server)
  await new Promise<void>((resolve) => server.close(() => resolve()))
  return port
}

const startHubFixture = async (): Promise<{ readonly hub: HubServerContext; readonly hubUrl: string; readonly port: number }> => {
  const hub = createHubServer({ version: '0.2.0' })
  cleanups.push(() => hub.close())
  const port = await listenOnFreePort(hub.server)
  const hubUrl = `http://127.0.0.1:${port}`
  const envelope: ProjectSnapshotEnvelope = {
    projectId: 'project-a',
    instanceId: 'browser-a',
    origin: 'http://localhost:5173',
    pageUrl: 'http://localhost:5173/fixture',
    title: 'Fixture',
    snapshot,
  }
  await fetch(`${hubUrl}/api/snapshot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(envelope),
  })
  return { hub, hubUrl, port }
}

const tempDir = async (prefix: string): Promise<string> => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  cleanups.push(() => rm(directory, { recursive: true, force: true }))
  return directory
}

const recorder = () => {
  const stdout: string[] = []
  const stderr: string[] = []
  return {
    stdout,
    stderr,
    io: { stdout: (value: string) => { stdout.push(value) }, stderr: (value: string) => { stderr.push(value) } },
  }
}

describe('runMain', () => {
  it('prints a JSON doctor report and returns a failing diagnostic exit code', async () => {
    const { hubUrl } = await startHubFixture()
    const out = recorder()
    const result = await runMain(['doctor', '--project', 'project-a', '--json'], { VIBE_CHECK_HUB_URL: hubUrl }, out.io)

    expect(result).toEqual({ kind: 'exit', code: 1 })
    expect(JSON.parse(out.stdout.join(''))).toMatchObject({
      schemaVersion: 1,
      selectedProjectId: 'project-a',
      ok: false,
    })
  })

  it('checks the hub named by doctor --hub-url', async () => {
    const { hubUrl } = await startHubFixture()
    const out = recorder()
    await runMain(['doctor', '--project', 'project-a', '--json', '--hub-url', hubUrl], {}, out.io)

    expect(JSON.parse(out.stdout.join(''))).toMatchObject({ hubUrl, selectedProjectId: 'project-a' })
  })

  it('prints persisted project impact as JSON and Markdown', async () => {
    const { hubUrl } = await startHubFixture()
    const jsonOutput = recorder()
    await expect(runMain(
      ['stats', '--project', 'project-a', '--json'],
      { VIBE_CHECK_HUB_URL: hubUrl },
      jsonOutput.io,
    )).resolves.toEqual({ kind: 'exit', code: 0 })
    expect(JSON.parse(jsonOutput.stdout.join(''))).toMatchObject({
      projectId: 'project-a',
      verifiedFixes: 0,
    })

    const markdownOutput = recorder()
    await runMain(['stats', '--project', 'project-a', '--markdown', '--hub-url', hubUrl], {}, markdownOutput.io)
    expect(markdownOutput.stdout.join('')).toContain('VibeCheck impact — project-a')
    expect(markdownOutput.stdout.join('')).toContain('helped verify 0 fixes')
  })

  it('explains an unreachable hub for stats instead of printing the raw request failure (E2E-11)', async () => {
    const port = await freePort()
    const error = await runMain(['stats', '--project', 'shop', '--hub-url', `http://127.0.0.1:${port}`], {}, recorder().io)
      .catch((value: unknown) => value)

    expect(error).toBeInstanceOf(CliError)
    expect((error as CliError).message).toBe(`Cannot reach the VibeCheck hub at http://127.0.0.1:${port}.`)
    expect((error as CliError).hint).toContain(`Start it with: ${HUB_START_COMMAND} --port ${port}`)
    expect((error as CliError).hint).toContain('VIBE_CHECK_HUB_URL')
  })

  it('prints help to stdout with exit 0, and bare usage to stderr with exit 1 (P11)', async () => {
    const help = recorder()
    await expect(runMain(['--help'], {}, help.io)).resolves.toEqual({ kind: 'exit', code: 0 })
    expect(help.stdout.join('')).toContain('Usage: vibe-check-mcp <command> [options]')
    expect(help.stderr).toEqual([])

    const setupHelp = recorder()
    await expect(runMain(['setup', '--help'], {}, setupHelp.io)).resolves.toEqual({ kind: 'exit', code: 0 })
    expect(setupHelp.stdout.join('')).toContain('Usage: vibe-check-mcp setup --agent')

    const bare = recorder()
    await expect(runMain([], {}, bare.io)).resolves.toEqual({ kind: 'exit', code: 1 })
    expect(bare.stdout).toEqual([])
    expect(bare.stderr.join('')).toContain('vibe-check-mcp connect')
    expect(bare.stderr.join('')).not.toContain('Fatal error')
  })

  it('prints the package version for --version', async () => {
    const out = recorder()
    await expect(runMain(['--version'], {}, out.io, { version: '0.4.0' })).resolves.toEqual({ kind: 'exit', code: 0 })
    expect(out.stdout).toEqual(['0.4.0\n'])
  })

  it('returns long-running hub and connect configurations without starting them', async () => {
    const out = recorder()
    await expect(runMain(['hub', '--port', '4317'], { VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json' }, out.io)).resolves.toEqual({
      kind: 'continue',
      config: {
        role: 'hub',
        host: '127.0.0.1',
        port: 4317,
        registryPath: '/tmp/projects.json',
        allowedOrigins: [],
        allowedHosts: [],
      },
    })
    await expect(runMain(['connect'], {}, out.io)).resolves.toEqual({
      kind: 'continue',
      config: { role: 'connect', hubUrl: 'http://127.0.0.1:4200' },
    })
  })

  it('registers a project as a finite command', async () => {
    const workspace = await tempDir('vibe-check-main-')
    await mkdir(join(workspace, 'app'))
    const calls: unknown[] = []
    const out = recorder()
    await expect(runMain(
      ['register', '--project', 'storefront', '--root', './app', '--origin', 'http://storefront.test:3000'],
      { VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json' },
      out.io,
      {
        cwd: workspace,
        registerProject: async (registryPath, projectId, root, options) => {
          calls.push({ registryPath, projectId, root, options })
        },
      },
    )).resolves.toEqual({ kind: 'exit', code: 0 })
    expect(calls).toEqual([{
      registryPath: '/tmp/projects.json',
      projectId: 'storefront',
      root: join(workspace, 'app'),
      options: { force: false, origins: ['http://storefront.test:3000'] },
    }])
    expect(out.stdout.join('')).toContain('Registered VibeCheck project "storefront"')
  })

  it('rejects a register --root that does not exist with a plain message (E2E-11)', async () => {
    const workspace = await tempDir('vibe-check-main-')
    const error = await runMain(['register', '--project', 'shop', '--root', 'nope'], {
      VIBE_CHECK_REGISTRY_PATH: join(workspace, 'projects.json'),
    }, recorder().io, { cwd: workspace }).catch((value: unknown) => value)

    expect(error).toBeInstanceOf(CliError)
    expect((error as CliError).message).toBe(`Project root ${join(workspace, 'nope')} does not exist or is not a folder.`)
  })

  it('moves a registration with register --force and removes it with unregister (MCP-10)', async () => {
    const workspace = await tempDir('vibe-check-main-')
    await Promise.all([mkdir(join(workspace, 'wt-main')), mkdir(join(workspace, 'wt-feature'))])
    const env = { VIBE_CHECK_REGISTRY_PATH: join(workspace, 'projects.json') }
    const run = async (argv: readonly string[]) => {
      const out = recorder()
      const result = await runMain(argv, env, out.io, { cwd: workspace }).catch((error: unknown) => error)
      return { result, stdout: out.stdout.join(''), stderr: out.stderr.join('') }
    }

    await run(['register', '--project', 'shop', '--root', 'wt-main'])
    const conflict = await run(['register', '--project', 'shop', '--root', 'wt-feature'])
    expect(conflict.result).toBeInstanceOf(CliError)
    expect((conflict.result as CliError).hint).toContain('--force')

    const moved = await run(['register', '--project', 'shop', '--root', 'wt-feature', '--force'])
    expect(moved.result).toEqual({ kind: 'exit', code: 0 })
    expect(moved.stdout).toContain(`Moved VibeCheck project "shop" to ${join(workspace, 'wt-feature')}`)
    expect(moved.stdout).toContain('Restart the hub')

    const again = await run(['register', '--project', 'shop', '--root', 'wt-feature'])
    expect(again.stdout).toContain('is already registered at')

    const removed = await run(['unregister', '--project', 'shop'])
    expect(removed.result).toEqual({ kind: 'exit', code: 0 })
    expect(removed.stdout).toContain(`Unregistered VibeCheck project "shop" (was ${join(workspace, 'wt-feature')})`)
    const missing = await run(['unregister', '--project', 'shop'])
    expect(missing.result).toEqual({ kind: 'exit', code: 1 })
    expect(missing.stderr).toContain('is not registered')
  })

  it('runs setup as a finite command and prints actions plus next steps', async () => {
    const out = recorder()
    const setupCalls: unknown[] = []
    const result = await runMain(
      ['setup', '--agent', 'codex', '--project', 'storefront', '--dry-run', '--port', '4317'],
      {},
      out.io,
      {
        cwd: '/tmp/storefront',
        version: '0.4.0',
        runSetup: async (options) => {
          setupCalls.push(options)
          return {
            projectId: 'storefront',
            componentPath: 'src/VibeCheckDevtools.tsx',
            actions: ['Install widget', 'Configure Codex'],
            nextSteps: ['Mount the component', 'Start the hub'],
          }
        },
      },
    )

    expect(result).toEqual({ kind: 'exit', code: 0 })
    expect(setupCalls).toEqual([{
      cwd: '/tmp/storefront',
      agent: 'codex',
      projectId: 'storefront',
      version: '0.4.0',
      dryRun: true,
      force: false,
      hubUrl: 'http://127.0.0.1:4317',
      origins: [],
    }])
    expect(out.stdout.join('')).toContain('VibeCheck setup — storefront (dry run)')
    expect(out.stdout.join('')).toContain('1. Install widget')
    expect(out.stdout.join('')).toContain('1. Mount the component')
  })
})

describe('up project resolution (E2E-10, MCP-12)', () => {
  const upIn = async (cwd: string, argv: readonly string[], registryPath: string) => {
    const out = recorder()
    const result = await runMain(['up', ...argv], { VIBE_CHECK_REGISTRY_PATH: registryPath }, out.io, { cwd })
      .catch((error: unknown) => error)
    return { result, stderr: out.stderr.join('') }
  }

  it('uses the package.json name, assumes Codex out loud, and registers the folder', async () => {
    const app = await tempDir('vibe-check-up-')
    const registryPath = join(app, 'registry.json')
    await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'acme-storefront' }))

    const { result, stderr } = await upIn(app, ['--port', '4317'], registryPath)
    expect(result).toEqual({
      kind: 'continue',
      config: expect.objectContaining({
        role: 'up',
        port: 4317,
        projectId: 'acme-storefront',
        agent: 'codex',
        agentAssumed: true,
      }) as unknown,
    })
    expect(stderr).toContain(`Registered ${app} for "acme-storefront"`)
    await expect(readProjectRegistry(registryPath)).resolves.toMatchObject({
      projects: { 'acme-storefront': { root: app } },
    })
  })

  it('prefers .vibecheck/config.json over the package.json name', async () => {
    const app = await tempDir('vibe-check-up-')
    await writeFile(join(app, 'package.json'), JSON.stringify({ name: 'acme-storefront' }))
    await mkdir(join(app, '.vibecheck'))
    await writeFile(join(app, '.vibecheck/config.json'), JSON.stringify({ schemaVersion: 1, projectId: 'storefront' }))

    const { result } = await upIn(app, ['--agent', 'cursor'], join(app, 'registry.json'))
    expect(result).toMatchObject({ config: { projectId: 'storefront', agent: 'cursor', agentAssumed: false } })
  })

  it('does not register a folder that is not the project, and says state is memory-only', async () => {
    const elsewhere = await tempDir('vibe-check-up-')
    const registryPath = join(elsewhere, 'registry.json')
    await writeFile(join(elsewhere, 'package.json'), JSON.stringify({ name: 'some-other-app' }))

    const { result, stderr } = await upIn(elsewhere, ['--project', 'shop'], registryPath)
    expect(result).toMatchObject({ config: { projectId: 'shop' } })
    expect(stderr).toContain('"shop" is not registered')
    expect(stderr).toContain('register --project shop --root')
    await expect(readProjectRegistry(registryPath)).resolves.toEqual({ schemaVersion: 1, projects: {} })
  })

  it('keeps going, with a --force hint, when the project is registered at another folder', async () => {
    const workspace = await tempDir('vibe-check-up-')
    const registryPath = join(workspace, 'registry.json')
    await Promise.all([mkdir(join(workspace, 'main')), mkdir(join(workspace, 'feature'))])
    await writeFile(join(workspace, 'feature/package.json'), JSON.stringify({ name: 'shop' }))
    await registerProjectRoot(registryPath, 'shop', join(workspace, 'main'))

    const { result, stderr } = await upIn(join(workspace, 'feature'), [], registryPath)
    expect(result).toMatchObject({ kind: 'continue', config: { projectId: 'shop' } })
    expect(stderr).toContain(`"shop" is registered at ${join(workspace, 'main')}`)
    expect(stderr).toContain('vibe-check-mcp register --project shop --force')
  })

  it('asks for --project instead of inventing "my-project"', async () => {
    const empty = await tempDir('vibe-check-up-')
    const { result } = await upIn(empty, [], join(empty, 'registry.json'))

    expect(result).toBeInstanceOf(CliError)
    expect((result as CliError).message).toContain('up needs a project ID: pass --project <id>')
    expect((result as CliError).hint).toContain('vibe-check-mcp hub')
  })
})

const upConfig = (port: number, overrides: Partial<UpRunConfig> = {}): UpRunConfig => ({
  role: 'up',
  host: '127.0.0.1',
  port,
  registryPath: join(tmpdir(), `vibe-check-main-test-${process.pid}.json`),
  allowedOrigins: [],
  allowedHosts: [],
  projectId: 'shop',
  agent: 'claude-code',
  agentAssumed: false,
  ...overrides,
})

describe('startHub', () => {
  it('starts the hub, then prints a banner that does not ask for a second hub (P10, MCP-09)', async () => {
    const port = await freePort()
    const out = recorder()
    const started = await startHub(upConfig(port), out.io, { version: '0.4.0' })
    if (started.kind === 'listening') cleanups.push(() => started.hub.close())

    expect(started).toMatchObject({ kind: 'listening', hubUrl: `http://127.0.0.1:${port}` })
    const stderr = out.stderr.join('')
    expect(stderr).toContain(`[vibe-check] Hub listening on http://127.0.0.1:${port}`)
    expect(stderr).toContain(`The hub is already running at http://127.0.0.1:${port}.`)
    expect(stderr).not.toContain('Start the local hub')
    expect(stderr).toContain(`-e VIBE_CHECK_HUB_URL=http://127.0.0.1:${port} --`)
    expect(stderr).toContain(`doctor --project shop --hub-url http://127.0.0.1:${port}`)
    expect(stderr).toContain(`set beaconUrl: 'http://127.0.0.1:${port}'`)
    await expect(probeVibeCheckHub(`http://127.0.0.1:${port}`)).resolves.toEqual({ version: '0.4.0' })
  })

  it('reuses a VibeCheck hub already on the port instead of crashing with EADDRINUSE (E2E-09)', async () => {
    const { port } = await startHubFixture()
    const out = recorder()
    const result = await startHub(upConfig(port, { allowedOrigins: ['http://shop.test:3000'] }), out.io, { version: '0.4.0' })

    expect(result).toEqual({ kind: 'exit', code: 0 })
    const stderr = out.stderr.join('')
    expect(stderr).toContain(`A VibeCheck hub (0.2.0) is already running at http://127.0.0.1:${port}. Reusing it`)
    expect(stderr).toContain('apply only to a hub this command starts')
    expect(stderr).toContain('## VibeCheck setup — shop')
    expect(stderr).not.toContain('EADDRINUSE')
    await expect(probeVibeCheckHub(`http://127.0.0.1:${port}`)).resolves.toEqual({ version: '0.2.0' })
  })

  it('names a port held by another program in plain language', async () => {
    const other = createHttpServer((_req, res) => { res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>dev</h1>') })
    const port = await listenOnFreePort(other)
    cleanups.push(() => new Promise<void>((resolve) => other.close(() => resolve())))
    const out = recorder()

    await expect(startHub({ ...upConfig(port), role: 'hub' }, out.io, { version: '0.4.0' })).resolves.toEqual({ kind: 'exit', code: 1 })
    expect(out.stderr.join('')).toContain(`Port ${port} on 127.0.0.1 is already in use by another program (not a VibeCheck hub).`)
  })

  it('warns about a non-loopback host and explains an address that is not on this machine', async () => {
    const out = recorder()
    const result = await startHub({ ...upConfig(4317), role: 'hub', host: '192.0.2.10' }, out.io, { version: '0.4.0' })

    expect(result).toEqual({ kind: 'exit', code: 1 })
    expect(out.stderr.join('')).toContain('VIBE_CHECK_HOST=192.0.2.10 is not a loopback address')
    expect(out.stderr.join('')).toContain('Cannot listen on 192.0.2.10')
  })

  it('passes the origin and host allowlists to the hub and prints each blocked origin once (MCP-01)', async () => {
    const port = await freePort()
    const seen: StartHubServerOptions[] = []
    const out = recorder()
    const started = await startHub(upConfig(port, {
      role: 'up',
      allowedOrigins: ['http://shop.test:3000'],
      allowedHosts: ['shop.test'],
    }), out.io, {
      version: '0.4.0',
      createServer: (options) => {
        seen.push(options)
        return createHubServer(options)
      },
    })
    if (started.kind === 'listening') cleanups.push(() => started.hub.close())

    expect(seen[0]).toMatchObject({
      version: '0.4.0',
      allowedOrigins: ['http://shop.test:3000'],
      allowedHosts: ['shop.test'],
    })
    seen[0]?.onBlockedOrigin?.('https://evil.example')
    seen[0]?.onBlockedOrigin?.('https://evil.example')
    const blocked = out.stderr.join('').split('\n').filter((line) => line.includes('Blocked a browser request'))
    expect(blocked).toEqual([
      '[vibe-check] Blocked a browser request from https://evil.example. If this is your app, restart the hub with --allow-origin https://evil.example.',
    ])
  })
})

describe('banner and hub helpers', () => {
  it('keeps the default-port banner free of env overrides and names the assumed agent', () => {
    const banner = formatUpBanner({ projectId: 'shop', agent: 'codex', agentAssumed: true, hubUrl: 'http://127.0.0.1:4200' })

    expect(banner).toContain('(Codex; pass --agent claude-code or --agent cursor for another client)')
    expect(banner).toContain('codex mcp add vibe-check -- npx')
    expect(banner).not.toContain('VIBE_CHECK_HUB_URL')
    expect(banner).not.toContain('beaconUrl')
  })

  it('brackets IPv6 hosts in hub URLs', () => {
    expect(hubUrlFor('127.0.0.1', 4200)).toBe('http://127.0.0.1:4200')
    expect(hubUrlFor('::1', 4317)).toBe('http://[::1]:4317')
  })

  it('turns an offline hub into a plain CLI error and rethrows anything else', async () => {
    const offline = { health: async () => { throw new HubClientError(0, 'hub-offline', null) } } as unknown as HubClient
    const broken = { health: async () => { throw new Error('boom') } } as unknown as HubClient

    await expect(ensureHubReachable('http://127.0.0.1:4317', offline)).rejects.toThrow('Cannot reach the VibeCheck hub at http://127.0.0.1:4317.')
    await expect(ensureHubReachable('http://127.0.0.1:4317', broken)).rejects.toThrow('boom')
  })

  it('reads a blocked probe as "not a VibeCheck hub"', async () => {
    await expect(probeVibeCheckHub(`http://127.0.0.1:${await freePort()}`)).resolves.toBeNull()
    const registry = await readFile(join(tmpdir(), 'definitely-missing.json'), 'utf8').catch(() => null)
    expect(registry).toBeNull()
  })
})
