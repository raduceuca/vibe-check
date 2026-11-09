import {
  AGENT_CLIENTS,
  ALLOWED_ORIGINS_ENV,
  DEFAULT_HUB_HOST,
  DEFAULT_HUB_PORT,
  DEFAULT_HUB_URL,
  HUB_URL_ENV,
  normalizeHubUrl,
  normalizeOriginPattern,
} from '@wcgw/vibe-check-protocol'
import { CliError } from './fatal.js'
import { defaultProjectRegistryPath } from './projectRegistry.js'

const SETUP_AGENTS = AGENT_CLIENTS

export type SetupAgent = (typeof SETUP_AGENTS)[number]

export const CLI_COMMANDS = [
  'up',
  'hub',
  'setup',
  'doctor',
  'stats',
  'register',
  'unregister',
  'connect',
] as const

export type CliCommand = (typeof CLI_COMMANDS)[number]

interface HubListenConfig {
  readonly host: string
  readonly port: number
  readonly registryPath: string
  /** Extra browser origins the hub accepts (normalized patterns); loopback is always allowed. */
  readonly allowedOrigins: readonly string[]
  /** Extra Host header values the hub accepts (`host` or `host:port`). */
  readonly allowedHosts: readonly string[]
}

export type CliConfig =
  | {
      readonly role: 'help'
      readonly topic: CliCommand | null
      /** False when no command was given at all (printed to stderr, exit 1). */
      readonly requested: boolean
    }
  | { readonly role: 'version' }
  | ({ readonly role: 'hub' } & HubListenConfig)
  | ({
      readonly role: 'up'
      readonly projectId: string | undefined
      readonly agent: SetupAgent | undefined
    } & HubListenConfig)
  | { readonly role: 'connect'; readonly hubUrl: string }
  | {
      readonly role: 'doctor'
      readonly hubUrl: string
      readonly projectId: string | undefined
      readonly json: boolean
    }
  | {
      readonly role: 'stats'
      readonly hubUrl: string
      readonly projectId: string
      readonly format: 'human' | 'json' | 'markdown'
    }
  | {
      readonly role: 'setup'
      readonly agent: SetupAgent
      readonly projectId: string | undefined
      readonly dryRun: boolean
      readonly force: boolean
      /** The hub the generated component and agent config point at. */
      readonly hubUrl: string
      readonly origins: readonly string[]
    }
  | {
      readonly role: 'register'
      readonly projectId: string
      readonly root: string
      readonly registryPath: string
      readonly force: boolean
      readonly origins: readonly string[]
    }
  | {
      readonly role: 'unregister'
      readonly projectId: string
      readonly registryPath: string
    }

// ── Help text ───────────────────────────────────────────────────────────────

interface CommandHelp {
  readonly usage: string
  readonly summary: string
  readonly options: readonly (readonly [string, string])[]
}

const PORT_HELP = ['--port <n>', `Port to listen on (default ${DEFAULT_HUB_PORT}, or VIBE_CHECK_PORT).`] as const
const ALLOW_ORIGIN_HELP = [
  '--allow-origin <origin>',
  `Also accept browser requests from this origin, e.g. http://myapp.test:3000. Repeatable. Localhost origins are always accepted. Same as ${ALLOWED_ORIGINS_ENV}.`,
] as const
const ALLOW_HOST_HELP = [
  '--allow-host <host[:port]>',
  'Also accept this Host header, for a hub reached through a proxy or a LAN name. Repeatable.',
] as const
const HUB_URL_HELP = ['--hub-url <url>', `Hub to talk to (default ${DEFAULT_HUB_URL}, or ${HUB_URL_ENV}).`] as const

const COMMAND_HELP: Readonly<Record<CliCommand, CommandHelp>> = {
  up: {
    usage: 'vibe-check-mcp up [--project <id>] [--agent <codex|claude-code|cursor>] [--port <n>] [--allow-origin <origin>]... [--allow-host <host[:port]>]...',
    summary: 'Start the local hub and print the setup steps for one project and agent. Reuses a hub that is already running on the port.',
    options: [
      ['--project <id>', 'Project ID your widget uses. Defaults to .vibecheck/config.json, then the package.json name.'],
      ['--agent <id>', 'codex (default), claude-code, or cursor.'],
      PORT_HELP,
      ALLOW_ORIGIN_HELP,
      ALLOW_HOST_HELP,
    ],
  },
  hub: {
    usage: 'vibe-check-mcp hub [--port <n>] [--allow-origin <origin>]... [--allow-host <host[:port]>]...',
    summary: 'Run only the long-running local hub that browser widgets send snapshots to.',
    options: [PORT_HELP, ALLOW_ORIGIN_HELP, ALLOW_HOST_HELP],
  },
  setup: {
    usage: 'vibe-check-mcp setup --agent <codex|claude-code|cursor> [--project <id>] [--port <n>] [--origin <origin>]... [--dry-run] [--force]',
    summary: 'Install the widget, generate VibeCheckDevtools.tsx, register the project, and configure one agent client.',
    options: [
      ['--agent <id>', 'Required: codex, claude-code, or cursor.'],
      ['--project <id>', 'Stable project ID. Defaults to the package.json name.'],
      ['--port <n>', `Hub port the widget and agent should use (default ${DEFAULT_HUB_PORT}).`],
      ['--origin <origin>', 'Register a dev origin that is not localhost, e.g. http://myapp.test:3000. Repeatable.'],
      ['--dry-run', 'Print every step without changing anything.'],
      ['--force', 'Replace the generated component, and move this project ID here if it is registered elsewhere.'],
    ],
  },
  doctor: {
    usage: 'vibe-check-mcp doctor [--project <id>] [--hub-url <url>] [--json]',
    summary: 'Read-only check of the hub, the browser project, and the agent watcher.',
    options: [
      ['--project <id>', 'Project to check. Required when several projects are active.'],
      HUB_URL_HELP,
      ['--json', 'Print the versioned DoctorReport JSON.'],
    ],
  },
  stats: {
    usage: 'vibe-check-mcp stats --project <id> [--hub-url <url>] [--json|--markdown]',
    summary: 'Print the project\'s verified fixes, regressions, and measured improvements.',
    options: [
      ['--project <id>', 'Required.'],
      HUB_URL_HELP,
      ['--json', 'Print JSON.'],
      ['--markdown', 'Print Markdown.'],
    ],
  },
  register: {
    usage: 'vibe-check-mcp register --project <id> [--root <path>] [--origin <origin>]... [--force]',
    summary: 'Record where a project lives, so the hub saves its history in <root>/.vibecheck/state.json.',
    options: [
      ['--project <id>', 'Required.'],
      ['--root <path>', 'Project folder (default: the current folder).'],
      ['--origin <origin>', 'Allow this browser origin for the project, e.g. http://myapp.test:3000. Repeatable.'],
      ['--force', 'Move the project ID here when it is registered at another folder.'],
    ],
  },
  unregister: {
    usage: 'vibe-check-mcp unregister --project <id>',
    summary: 'Remove a project from the registry. Its .vibecheck/state.json is left in place.',
    options: [['--project <id>', 'Required.']],
  },
  connect: {
    usage: 'vibe-check-mcp connect',
    summary: `Stdio MCP bridge to the hub. Your agent client starts it from its MCP config; set ${HUB_URL_ENV} there for a non-default hub.`,
    options: [],
  },
}

const ENVIRONMENT_HELP: readonly (readonly [string, string])[] = [
  ['VIBE_CHECK_PORT', `hub and up port (default ${DEFAULT_HUB_PORT})`],
  ['VIBE_CHECK_HOST', `hub and up bind address (default ${DEFAULT_HUB_HOST})`],
  [ALLOWED_ORIGINS_ENV, 'extra browser origins for hub and up, comma separated'],
  [HUB_URL_ENV, 'hub URL for connect, doctor, and stats'],
  ['VIBE_CHECK_REGISTRY_PATH', 'project registry file (default ~/.vibecheck/projects.json)'],
]

const table = (rows: readonly (readonly [string, string])[]): readonly string[] => {
  const width = Math.max(0, ...rows.map(([name]) => name.length))
  return rows.map(([name, text]) => `  ${name.padEnd(width)}  ${text}`)
}

/** Plain, one-command-per-line help. `topic` prints one command's options. */
export const formatUsage = (topic: CliCommand | null = null): string => {
  if (topic !== null) {
    const help = COMMAND_HELP[topic]
    return [
      `Usage: ${help.usage}`,
      '',
      help.summary,
      ...(help.options.length > 0 ? ['', 'Options:', ...table(help.options)] : []),
      '',
    ].join('\n')
  }
  return [
    'Usage: vibe-check-mcp <command> [options]',
    '',
    'Commands:',
    ...table(CLI_COMMANDS.map((command) => [command, COMMAND_HELP[command].summary] as const)),
    '',
    'Environment:',
    ...table(ENVIRONMENT_HELP),
    '',
    'Run "vibe-check-mcp <command> --help" for a command\'s options, or "vibe-check-mcp --version" for the version.',
    '',
  ].join('\n')
}

// ── Option parsing ──────────────────────────────────────────────────────────

type OptionSpec =
  | { readonly kind: 'flag' }
  | { readonly kind: 'value' | 'list'; readonly needs: string }

interface ParsedOptions {
  readonly flags: ReadonlySet<string>
  readonly values: ReadonlyMap<string, string>
  readonly lists: ReadonlyMap<string, readonly string[]>
}

const capitalize = (value: string): string => `${value.charAt(0).toUpperCase()}${value.slice(1)}`

const usageError = (command: CliCommand, message: string): CliError =>
  new CliError(message, `Run "vibe-check-mcp ${command} --help" to see its options.`)

const parseOptions = (
  command: CliCommand,
  args: readonly string[],
  specs: Readonly<Record<string, OptionSpec>>,
): ParsedOptions => {
  const flags = new Set<string>()
  const values = new Map<string, string>()
  const lists = new Map<string, readonly string[]>()
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index]
    if (option === undefined || option.length === 0) continue
    const spec = Object.hasOwn(specs, option) ? specs[option] : undefined
    if (spec === undefined) throw usageError(command, `Unknown ${command} option: ${option}`)
    if (spec.kind === 'flag') {
      if (flags.has(option)) throw usageError(command, `Duplicate ${command} option: ${option}`)
      flags.add(option)
      continue
    }
    const value = args[index + 1]
    if (value === undefined || value.length === 0 || value.startsWith('--')) {
      throw usageError(command, `${capitalize(command)} ${option} requires ${spec.needs}`)
    }
    index += 1
    if (spec.kind === 'value') {
      if (values.has(option)) throw usageError(command, `Duplicate ${command} option: ${option}`)
      values.set(option, value)
      continue
    }
    lists.set(option, [...(lists.get(option) ?? []), value])
  }
  return { flags, values, lists }
}

const isCliCommand = (value: string | undefined): value is CliCommand =>
  value !== undefined && (CLI_COMMANDS as readonly string[]).includes(value)

const isSetupAgent = (value: string): value is SetupAgent =>
  (SETUP_AGENTS as readonly string[]).includes(value)

const parseAgent = (command: CliCommand, value: string): SetupAgent => {
  if (isSetupAgent(value)) return value
  const hint = value.trim().toLowerCase() === 'claude' ? ' Did you mean claude-code?' : ''
  throw usageError(command, `Unknown ${command} agent: ${value}. Use one of: ${SETUP_AGENTS.join(', ')}.${hint}`)
}

const parsePort = (command: CliCommand, value: string, source: string): number => {
  const trimmed = value.trim()
  const port = /^\d{1,5}$/.test(trimmed) ? Number(trimmed) : Number.NaN
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw usageError(command, `${source} must be a port number from 1 to 65535 (got "${value}").`)
  }
  return port
}

/** `--port` wins over VIBE_CHECK_PORT; an invalid value is an error, never a silent 4200. */
const resolvePort = (
  command: CliCommand,
  flag: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): number => {
  if (flag !== undefined) return parsePort(command, flag, '--port')
  const fromEnv = env['VIBE_CHECK_PORT']
  if (fromEnv === undefined || fromEnv.trim().length === 0) return DEFAULT_HUB_PORT
  return parsePort(command, fromEnv, 'VIBE_CHECK_PORT')
}

const parseHubUrl = (command: CliCommand, value: string, source: string): string => {
  const normalized = normalizeHubUrl(value)
  const invalid = usageError(command, `${source} must be an http:// URL such as ${DEFAULT_HUB_URL} (got "${value}").`)
  let url: URL
  try {
    url = new URL(normalized)
  } catch {
    throw invalid
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw invalid
  return normalized
}

/** `--hub-url` wins over VIBE_CHECK_HUB_URL; both are validated and normalized. */
const resolveHubUrl = (
  command: CliCommand,
  flag: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): string => {
  if (flag !== undefined) return parseHubUrl(command, flag, '--hub-url')
  const fromEnv = env[HUB_URL_ENV]
  if (fromEnv === undefined || fromEnv.trim().length === 0) return DEFAULT_HUB_URL
  return parseHubUrl(command, fromEnv, HUB_URL_ENV)
}

const parseOrigins = (command: CliCommand, values: readonly string[], source: string): readonly string[] => {
  const patterns = values.map((value) => {
    const pattern = normalizeOriginPattern(value)
    if (pattern === null) {
      throw usageError(
        command,
        `${source} needs an origin such as http://myapp.test:3000 or https://*.example.dev (got "${value}").`,
      )
    }
    return pattern
  })
  return [...new Set(patterns)]
}

const HOST_VALUE = /^(\[[0-9a-f:.]+\]|[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\d{1,5}))?$/

const parseHosts = (command: CliCommand, values: readonly string[]): readonly string[] => {
  const hosts = values.map((value) => {
    const host = value.trim().toLowerCase()
    const match = HOST_VALUE.exec(host)
    const port = match?.[2] === undefined ? null : Number(match[2])
    if (!match || (port !== null && (port < 1 || port > 65_535))) {
      throw usageError(command, `--allow-host needs a host name such as myapp.test or myapp.test:4200 (got "${value}").`)
    }
    return host
  })
  return [...new Set(hosts)]
}

const envOrigins = (
  command: CliCommand,
  env: Readonly<Record<string, string | undefined>>,
): readonly string[] => {
  const raw = env[ALLOWED_ORIGINS_ENV]
  if (raw === undefined) return []
  const entries = raw.split(/[\s,]+/).filter((entry) => entry.length > 0)
  return parseOrigins(command, entries, ALLOWED_ORIGINS_ENV)
}

const registryPathFrom = (env: Readonly<Record<string, string | undefined>>): string =>
  env['VIBE_CHECK_REGISTRY_PATH'] ?? defaultProjectRegistryPath()

const HUB_OPTIONS: Readonly<Record<string, OptionSpec>> = {
  '--port': { kind: 'value', needs: 'a port' },
  '--allow-origin': { kind: 'list', needs: 'an origin' },
  '--allow-host': { kind: 'list', needs: 'a host' },
}

const hubListenConfig = (
  command: CliCommand,
  options: ParsedOptions,
  env: Readonly<Record<string, string | undefined>>,
): HubListenConfig => ({
  host: env['VIBE_CHECK_HOST'] ?? DEFAULT_HUB_HOST,
  port: resolvePort(command, options.values.get('--port'), env),
  registryPath: registryPathFrom(env),
  allowedOrigins: [...new Set([
    ...envOrigins(command, env),
    ...parseOrigins(command, options.lists.get('--allow-origin') ?? [], '--allow-origin'),
  ])],
  allowedHosts: parseHosts(command, options.lists.get('--allow-host') ?? []),
})

export const parseCliConfig = (
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): CliConfig => {
  const role = argv[0]
  if (role === undefined || role.length === 0) return { role: 'help', topic: null, requested: false }
  if (role === '--help' || role === '-h' || role === 'help') {
    const topic = argv[1]
    return { role: 'help', topic: isCliCommand(topic) ? topic : null, requested: true }
  }
  if (role === '--version' || role === '-v' || role === 'version') return { role: 'version' }
  if (!isCliCommand(role)) {
    throw new CliError(`Unknown command: ${role}`, 'Run "vibe-check-mcp --help" to see every command.')
  }

  const args = argv.slice(1)
  if (args.includes('--help') || args.includes('-h')) return { role: 'help', topic: role, requested: true }

  if (role === 'hub') {
    return { role, ...hubListenConfig(role, parseOptions(role, args, HUB_OPTIONS), env) }
  }
  if (role === 'up') {
    const options = parseOptions(role, args, {
      ...HUB_OPTIONS,
      '--project': { kind: 'value', needs: 'a project ID' },
      '--agent': { kind: 'value', needs: 'an agent' },
    })
    const agent = options.values.get('--agent')
    return {
      role,
      ...hubListenConfig(role, options, env),
      projectId: options.values.get('--project'),
      agent: agent === undefined ? undefined : parseAgent(role, agent),
    }
  }
  if (role === 'connect') {
    // Extra arguments are ignored: agent configs written by older versions may pass some.
    return { role, hubUrl: resolveHubUrl(role, undefined, env) }
  }
  if (role === 'doctor') {
    const options = parseOptions(role, args, {
      '--json': { kind: 'flag' },
      '--project': { kind: 'value', needs: 'a project ID' },
      '--hub-url': { kind: 'value', needs: 'a URL' },
    })
    return {
      role,
      hubUrl: resolveHubUrl(role, options.values.get('--hub-url'), env),
      projectId: options.values.get('--project'),
      json: options.flags.has('--json'),
    }
  }
  if (role === 'stats') {
    const options = parseOptions(role, args, {
      '--project': { kind: 'value', needs: 'a project ID' },
      '--hub-url': { kind: 'value', needs: 'a URL' },
      '--json': { kind: 'flag' },
      '--markdown': { kind: 'flag' },
    })
    if (options.flags.has('--json') && options.flags.has('--markdown')) {
      throw usageError(role, 'Stats accepts only one output format')
    }
    const projectId = options.values.get('--project')
    if (!projectId) throw usageError(role, 'Stats --project is required')
    return {
      role,
      hubUrl: resolveHubUrl(role, options.values.get('--hub-url'), env),
      projectId,
      format: options.flags.has('--json') ? 'json' : options.flags.has('--markdown') ? 'markdown' : 'human',
    }
  }
  if (role === 'setup') {
    const options = parseOptions(role, args, {
      '--dry-run': { kind: 'flag' },
      '--force': { kind: 'flag' },
      '--agent': { kind: 'value', needs: 'an agent' },
      '--project': { kind: 'value', needs: 'a project ID' },
      '--port': { kind: 'value', needs: 'a port' },
      '--origin': { kind: 'list', needs: 'an origin' },
    })
    const agent = options.values.get('--agent')
    if (agent === undefined) throw usageError(role, 'Setup --agent is required (codex, claude-code, or cursor)')
    const port = options.values.get('--port')
    return {
      role,
      agent: parseAgent(role, agent),
      projectId: options.values.get('--project'),
      dryRun: options.flags.has('--dry-run'),
      force: options.flags.has('--force'),
      hubUrl: port === undefined
        ? DEFAULT_HUB_URL
        : `http://${DEFAULT_HUB_HOST}:${parsePort(role, port, '--port')}`,
      origins: parseOrigins(role, options.lists.get('--origin') ?? [], '--origin'),
    }
  }
  if (role === 'register') {
    const options = parseOptions(role, args, {
      '--project': { kind: 'value', needs: 'a project ID' },
      '--root': { kind: 'value', needs: 'a path' },
      '--origin': { kind: 'list', needs: 'an origin' },
      '--force': { kind: 'flag' },
    })
    const projectId = options.values.get('--project')
    if (!projectId) throw usageError(role, 'Register --project is required')
    return {
      role,
      projectId,
      root: options.values.get('--root') ?? '.',
      registryPath: registryPathFrom(env),
      force: options.flags.has('--force'),
      origins: parseOrigins(role, options.lists.get('--origin') ?? [], '--origin'),
    }
  }
  const options = parseOptions(role, args, { '--project': { kind: 'value', needs: 'a project ID' } })
  const projectId = options.values.get('--project')
  if (!projectId) throw usageError(role, 'Unregister --project is required')
  return { role, projectId, registryPath: registryPathFrom(env) }
}
