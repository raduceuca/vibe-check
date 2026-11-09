import { parseCliConfig, formatUsage, type CliConfig, type SetupAgent } from './cli.js'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  DEFAULT_HUB_PORT,
  HUB_URL_ENV,
  formatSetupPack,
  getAgentClientSetup,
  getHubStartCommand,
  hubPortFromUrl,
  isLoopbackHostname,
} from '@wcgw/vibe-check-protocol'
import { formatDoctorHuman, formatDoctorJson, runDoctor } from './doctor.js'
import { CliError } from './fatal.js'
import {
  readLocalProjectIds,
  runSetup as runSetupCommand,
  type SetupOptions,
  type SetupResult,
} from './setup.js'
import {
  ProjectRootConflictError,
  registerProjectRoot,
  resolveProjectRoot,
  unregisterProjectRoot,
  type RegisterProjectOptions,
  type RegisterProjectResult,
} from './projectRegistry.js'
import { HubClientError, createHubClient, type HubClient } from './hubClient.js'
import { createHubServer, type HubServerContext, type HubServerOptions } from './hubServer.js'
import { formatImpactHuman, formatImpactJson, formatImpactMarkdown } from './impact.js'

export interface CliIo {
  readonly stdout: (value: string) => void
  readonly stderr: (value: string) => void
}

type HubCliConfig = Extract<CliConfig, { readonly role: 'hub' }>

/** `up` after main resolved its project ID (flag → .vibecheck/config.json → package.json name). */
export type UpRunConfig = Omit<Extract<CliConfig, { readonly role: 'up' }>, 'projectId' | 'agent'> & {
  readonly projectId: string
  readonly agent: SetupAgent
  /** True when --agent was not given and Codex was assumed. */
  readonly agentAssumed: boolean
}

type LongRunningCliConfig =
  | HubCliConfig
  | UpRunConfig
  | Extract<CliConfig, { readonly role: 'connect' }>

export interface RunMainDependencies {
  readonly cwd?: string
  readonly version?: string
  readonly runSetup?: (options: SetupOptions) => Promise<SetupResult>
  readonly registerProject?: (
    registryPath: string,
    projectId: string,
    root: string,
    options?: RegisterProjectOptions,
  ) => Promise<RegisterProjectResult | void>
}

export type CliRunResult =
  | { readonly kind: 'exit'; readonly code: number }
  | { readonly kind: 'continue'; readonly config: LongRunningCliConfig }

const isHubOffline = (error: unknown): boolean =>
  error instanceof HubClientError && (error.code === 'hub-offline' || error.code === 'not-vibe-check-hub')

/** Plain "cannot reach the hub" error with the start command for that exact URL. */
export const hubUnreachableError = (hubUrl: string): CliError => new CliError(
  `Cannot reach the VibeCheck hub at ${hubUrl}.`,
  `Start it with: ${getHubStartCommand({ preferUp: false, hubUrl })}\n`
  + `If the hub runs elsewhere, set ${HUB_URL_ENV} (for an agent, in its MCP config) to the hub's URL.`,
)

/** Resolves when the hub answers its health check; otherwise throws hubUnreachableError. */
export const ensureHubReachable = async (hubUrl: string, client: HubClient): Promise<void> => {
  try {
    await client.health()
  } catch (error) {
    if (isHubOffline(error)) throw hubUnreachableError(hubUrl)
    throw error
  }
}

const directoryExists = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

const describeRegistration = (result: RegisterProjectResult | void, projectId: string, root: string): string => {
  if (!result || result.status === 'created') return `Registered VibeCheck project "${projectId}" at ${root}\n`
  if (result.status === 'unchanged') return `VibeCheck project "${projectId}" is already registered at ${root}\n`
  if (result.status === 'updated') {
    return `Updated VibeCheck project "${projectId}" at ${root} (allowed origins: ${result.origins.join(', ')})\n`
  }
  return [
    `Moved VibeCheck project "${projectId}" to ${root}`,
    `(was ${result.previousRoot ?? 'unknown'}${result.previousRootMissing ? ', which no longer exists' : ''}).`,
    'Restart the hub if it is running, so it saves state in the new folder.\n',
  ].join(' ')
}

/**
 * Resolves `up`'s project ID and registers the current folder when it is
 * that project (its .vibecheck/config.json or package.json name matches), so
 * the hub keeps a durable .vibecheck/state.json. Never fails `up` over the
 * registry: problems are printed as notes.
 */
const prepareUp = async (
  config: Extract<CliConfig, { readonly role: 'up' }>,
  cwd: string,
  io: CliIo,
  registerProject: NonNullable<RunMainDependencies['registerProject']>,
): Promise<UpRunConfig> => {
  const local = await readLocalProjectIds(cwd)
  const projectId = config.projectId ?? local.configProjectId ?? local.packageName
  if (!projectId) {
    throw new CliError(
      'up needs a project ID: pass --project <id> (the projectId your widget uses).',
      'Or run up in your app folder: it reads .vibecheck/config.json, then the package.json name. To start only the hub, run "vibe-check-mcp hub".',
    )
  }
  const resolved: UpRunConfig = {
    role: 'up',
    host: config.host,
    port: config.port,
    registryPath: config.registryPath,
    allowedOrigins: config.allowedOrigins,
    allowedHosts: config.allowedHosts,
    projectId,
    agent: config.agent ?? 'codex',
    agentAssumed: config.agent === undefined,
  }

  const ownsCwd = local.configProjectId === projectId || local.packageName === projectId
  try {
    if (ownsCwd) {
      const result = await registerProject(config.registryPath, projectId, cwd)
      if (result && result.status === 'created') {
        io.stderr(`[vibe-check] Registered ${result.root} for "${projectId}", so its fix history is saved in .vibecheck/state.json.\n`)
      } else if (result && result.status === 'moved') {
        io.stderr(`[vibe-check] Moved "${projectId}" to ${result.root}; ${result.previousRoot ?? 'its old folder'} no longer exists.\n`)
      }
    } else if (await resolveProjectRoot(config.registryPath, projectId) === null) {
      io.stderr([
        `[vibe-check] "${projectId}" is not registered, so its fix history lives only in this hub's memory.`,
        `To keep it across restarts, run up from the app folder, or: vibe-check-mcp register --project ${projectId} --root <app folder>\n`,
      ].join('\n'))
    }
  } catch (error) {
    if (error instanceof ProjectRootConflictError) {
      io.stderr([
        `[vibe-check] "${projectId}" is registered at ${error.existingRoot}; its fix history is saved there.`,
        `To move it to this folder, run: vibe-check-mcp register --project ${projectId} --force\n`,
      ].join('\n'))
    } else {
      io.stderr(`[vibe-check] Could not register this folder: ${error instanceof Error ? error.message : String(error)}\n`)
    }
  }
  return resolved
}

export const runMain = async (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  io: CliIo,
  dependencies: RunMainDependencies = {},
): Promise<CliRunResult> => {
  const config = parseCliConfig(argv, env)
  const cwd = dependencies.cwd ?? process.cwd()
  const registerProject = dependencies.registerProject ?? registerProjectRoot

  if (config.role === 'help') {
    if (config.requested) {
      io.stdout(formatUsage(config.topic))
      return { kind: 'exit', code: 0 }
    }
    io.stderr(`${formatUsage()}\nAgent clients start the MCP bridge with "vibe-check-mcp connect".\n`)
    return { kind: 'exit', code: 1 }
  }
  if (config.role === 'version') {
    io.stdout(`${dependencies.version ?? 'unknown'}\n`)
    return { kind: 'exit', code: 0 }
  }
  if (config.role === 'register') {
    const root = resolve(cwd, config.root)
    if (!await directoryExists(root)) {
      throw new CliError(`Project root ${root} does not exist or is not a folder.`, 'Pass --root <path> to the folder that holds your app.')
    }
    const result = await registerProject(config.registryPath, config.projectId, root, {
      force: config.force,
      origins: config.origins,
    })
    io.stdout(describeRegistration(result, config.projectId, root))
    return { kind: 'exit', code: 0 }
  }
  if (config.role === 'unregister') {
    const removed = await unregisterProjectRoot(config.registryPath, config.projectId)
    if (removed === null) {
      io.stderr(`VibeCheck project "${config.projectId}" is not registered; nothing to remove.\n`)
      return { kind: 'exit', code: 1 }
    }
    io.stdout([
      `Unregistered VibeCheck project "${config.projectId}" (was ${removed}).`,
      'Its .vibecheck/state.json was left in place. Restart the hub if it is running.\n',
    ].join(' '))
    return { kind: 'exit', code: 0 }
  }
  if (config.role === 'setup') {
    const version = dependencies.version
    if (!version) throw new Error('Setup requires the running VibeCheck package version')
    const setup = dependencies.runSetup ?? runSetupCommand
    const result = await setup({
      cwd,
      agent: config.agent,
      projectId: config.projectId,
      version,
      dryRun: config.dryRun,
      force: config.force,
      hubUrl: config.hubUrl,
      origins: config.origins,
    })
    const heading = `VibeCheck setup — ${result.projectId}${config.dryRun ? ' (dry run)' : ''}`
    const lines = [
      heading,
      '',
      'Actions:',
      ...result.actions.map((action, index) => `${index + 1}. ${action}`),
      '',
      'Next steps:',
      ...result.nextSteps.map((step, index) => `${index + 1}. ${step}`),
    ]
    io.stdout(`${lines.join('\n')}\n`)
    return { kind: 'exit', code: 0 }
  }
  if (config.role === 'stats') {
    let impact: Awaited<ReturnType<HubClient['getProjectImpact']>>
    try {
      impact = await createHubClient(config.hubUrl).getProjectImpact(config.projectId)
    } catch (error) {
      if (isHubOffline(error)) throw hubUnreachableError(config.hubUrl)
      throw error
    }
    if (!impact) {
      io.stderr(`VibeCheck project "${config.projectId}" is not active. Open it with the widget enabled, then retry.\n`)
      return { kind: 'exit', code: 1 }
    }
    io.stdout(config.format === 'json'
      ? formatImpactJson(impact)
      : config.format === 'markdown'
        ? formatImpactMarkdown(impact)
        : formatImpactHuman(impact))
    return { kind: 'exit', code: 0 }
  }
  if (config.role === 'up') {
    return { kind: 'continue', config: await prepareUp(config, cwd, io, registerProject) }
  }
  if (config.role !== 'doctor') return { kind: 'continue', config }

  const doctorReport = await runDoctor({
    hubUrl: config.hubUrl,
    projectId: config.projectId,
  })
  io.stdout(config.json ? formatDoctorJson(doctorReport) : formatDoctorHuman(doctorReport))
  return { kind: 'exit', code: doctorReport.ok ? 0 : 1 }
}

// ── Long-running hub (hub / up) ─────────────────────────────────────────────

/** The URL clients use for a bound host/port (IPv6 literals in brackets). */
export const hubUrlFor = (host: string, port: number): string =>
  `http://${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}:${port}`

export interface UpBannerOptions {
  readonly projectId: string
  readonly agent: SetupAgent
  readonly agentAssumed: boolean
  readonly hubUrl: string
}

/** What `up` prints once a hub is reachable: it never tells the user to start a second hub. */
export const formatUpBanner = ({ projectId, agent, agentAssumed, hubUrl }: UpBannerOptions): string => {
  const label = getAgentClientSetup(agent).label
  const assumed = agentAssumed ? '; pass --agent claude-code or --agent cursor for another client' : ''
  const port = hubPortFromUrl(hubUrl)
  const lines = [
    `[vibe-check] Guided setup for project "${projectId}" (${label}${assumed})`,
    formatSetupPack({ projectId, agent, hubUrl, hubRunning: true }),
  ]
  if (port !== null && port !== DEFAULT_HUB_PORT) {
    lines.push(`[vibe-check] This hub is not on the default port: set beaconUrl: '${hubUrl}' in your widget (VibeCheckDevtools).`)
  }
  return `${lines.join('\n')}\n`
}

export interface HubHealthInfo {
  readonly version: string
}

/** GET /api/health with a short timeout; null unless a VibeCheck hub answers. */
export const probeVibeCheckHub = async (hubUrl: string, timeoutMs = 1_500): Promise<HubHealthInfo | null> => {
  try {
    const response = await fetch(`${hubUrl}/api/health`, { signal: AbortSignal.timeout(timeoutMs) })
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null || !('service' in body) || body.service !== 'vibe-check-hub') {
      return null
    }
    return { version: 'version' in body && typeof body.version === 'string' ? body.version : 'unknown' }
  } catch {
    return null
  }
}

// The request-gate options mcp-hub adds to HubServerOptions (CONTRACT §3.5,
// §3.11). Declared here as well so this file type-checks whichever side lands
// first; the shapes are the contract's, so they merge to the same type.
interface HubGateOptions {
  readonly allowedOrigins?: readonly string[]
  readonly allowedHosts?: readonly string[]
  readonly onBlockedOrigin?: (origin: string) => void
}

export type StartHubServerOptions = HubServerOptions & HubGateOptions

export interface StartHubDependencies {
  readonly version: string
  readonly createServer?: (options: StartHubServerOptions) => HubServerContext
  readonly probeHub?: (hubUrl: string) => Promise<HubHealthInfo | null>
}

export type StartHubResult =
  | { readonly kind: 'listening'; readonly hub: HubServerContext; readonly hubUrl: string }
  | { readonly kind: 'exit'; readonly code: number }

const errorCode = (error: unknown): string | null =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null

const listen = (hub: HubServerContext, port: number, host: string): Promise<void> =>
  new Promise((resolveListen, rejectListen) => {
    const onError = (error: Error): void => {
      hub.server.off('listening', onListening)
      rejectListen(error)
    }
    const onListening = (): void => {
      hub.server.off('error', onError)
      resolveListen()
    }
    hub.server.once('error', onError)
    hub.server.once('listening', onListening)
    hub.server.listen(port, host)
  })

/**
 * Starts the hub for `hub` / `up`. A port already held by a VibeCheck hub is
 * reused (exit 0, `up` still prints its banner); a port held by something else
 * gets a plain message instead of a stack trace.
 */
export const startHub = async (
  config: HubCliConfig | UpRunConfig,
  io: CliIo,
  dependencies: StartHubDependencies,
): Promise<StartHubResult> => {
  const hubUrl = hubUrlFor(config.host, config.port)
  const banner = (): void => {
    if (config.role === 'up') io.stderr(formatUpBanner({ ...config, hubUrl }))
  }
  if (!isLoopbackHostname(config.host)) {
    io.stderr([
      `[vibe-check] Warning: VIBE_CHECK_HOST=${config.host} is not a loopback address, so other machines on your network can reach this hub.`,
      'Use 127.0.0.1 unless you need that.\n',
    ].join(' '))
  }

  const blockedOrigins = new Set<string>()
  const serverOptions: StartHubServerOptions = {
    version: dependencies.version,
    registryPath: config.registryPath,
    allowedOrigins: config.allowedOrigins,
    allowedHosts: config.allowedHosts,
    onBlockedOrigin: (origin) => {
      if (blockedOrigins.has(origin)) return
      blockedOrigins.add(origin)
      io.stderr(`[vibe-check] Blocked a browser request from ${origin}. If this is your app, restart the hub with --allow-origin ${origin}.\n`)
    },
    onPersistenceWarning: (message) => io.stderr(`[vibe-check] ${message}\n`),
  }
  const hub = (dependencies.createServer ?? createHubServer)(serverOptions)

  try {
    await listen(hub, config.port, config.host)
  } catch (error) {
    await hub.close().catch(() => undefined)
    const code = errorCode(error)
    if (code === 'EADDRINUSE') {
      const running = await (dependencies.probeHub ?? probeVibeCheckHub)(hubUrl)
      if (running) {
        io.stderr(`[vibe-check] A VibeCheck hub (${running.version}) is already running at ${hubUrl}. Reusing it; this command exits and leaves that hub running.\n`)
        if (config.allowedOrigins.length > 0 || config.allowedHosts.length > 0) {
          io.stderr('[vibe-check] Your --allow-origin / --allow-host options apply only to a hub this command starts. Stop the running hub and rerun this command to use them.\n')
        }
        banner()
        return { kind: 'exit', code: 0 }
      }
      io.stderr([
        `[vibe-check] Port ${config.port} on ${config.host} is already in use by another program (not a VibeCheck hub).`,
        `Pick a free port, e.g. --port ${config.port === 4300 ? 4301 : 4300}, and use the same port in the widget's beaconUrl and the agent setup.\n`,
      ].join('\n'))
      return { kind: 'exit', code: 1 }
    }
    if (code === 'EACCES') {
      io.stderr(`[vibe-check] Not allowed to listen on port ${config.port}. Pick a port above 1024 with --port.\n`)
      return { kind: 'exit', code: 1 }
    }
    if (code === 'EADDRNOTAVAIL' || code === 'ENOTFOUND') {
      io.stderr(`[vibe-check] Cannot listen on ${config.host}: it is not an address of this machine. Unset VIBE_CHECK_HOST to use 127.0.0.1.\n`)
      return { kind: 'exit', code: 1 }
    }
    throw error
  }

  io.stderr(`[vibe-check] Hub listening on ${hubUrl}\n`)
  banner()
  return { kind: 'listening', hub, hubUrl }
}
