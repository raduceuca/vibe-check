import { execFile } from 'node:child_process'
import {
  access,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import {
  DEFAULT_HUB_PORT,
  DEFAULT_HUB_URL,
  HUB_URL_ENV,
  MCP_PACKAGE_NAME,
  WIDGET_PACKAGE_NAME,
  getAgentClientSetup,
  getWatchInstruction,
  hubPortFromUrl,
  normalizeHubUrl,
} from '@wcgw/vibe-check-protocol'
import type { SetupAgent } from './cli.js'
import { CliError } from './fatal.js'
import {
  ProjectRootConflictError,
  defaultProjectRegistryPath,
  registerProjectRoot,
  resolveProjectRoot,
} from './projectRegistry.js'

const execFileAsync = promisify(execFile)
const WIDGET_PACKAGE = WIDGET_PACKAGE_NAME
const MCP_PACKAGE = MCP_PACKAGE_NAME
const GITIGNORE_BLOCK = [
  '# VibeCheck runtime state',
  '.vibecheck/state.json',
  '.vibecheck/state.json.corrupt-*',
  '.vibecheck/*.tmp',
].join('\n')

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun'

export interface SetupCommandResult {
  readonly exitCode: number
  readonly error?: string
}

export type SetupCommandRunner = (
  command: string,
  args: readonly string[],
  cwd: string,
) => Promise<SetupCommandResult>

export interface SetupOptions {
  readonly cwd: string
  readonly agent: SetupAgent
  readonly projectId?: string
  readonly version: string
  readonly dryRun: boolean
  /** Replace the generated component, and move this project ID here if it is registered elsewhere. */
  readonly force: boolean
  /** Since 0.4. Hub the widget and agent use (default DEFAULT_HUB_URL); a non-default one goes into both. */
  readonly hubUrl?: string
  /** Since 0.4. Extra browser origins registered for this project (see `register --origin`). */
  readonly origins?: readonly string[]
}

export interface SetupDependencies {
  readonly runCommand?: SetupCommandRunner
}

export interface SetupResult {
  readonly projectId: string
  readonly componentPath: string
  readonly actions: readonly string[]
  readonly nextSteps: readonly string[]
}

interface PackageJson {
  readonly name?: unknown
  readonly packageManager?: unknown
  readonly dependencies?: unknown
  readonly devDependencies?: unknown
  readonly peerDependencies?: unknown
}

interface CommandSpec {
  readonly command: string
  readonly args: readonly string[]
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isMissing = (error: unknown): boolean =>
  isRecord(error) && error['code'] === 'ENOENT'

const hasDeclaredPackage = (packageJson: PackageJson, packageName: string): boolean =>
  [packageJson.dependencies, packageJson.devDependencies, packageJson.peerDependencies]
    .some((section) => isRecord(section) && typeof section[packageName] === 'string')

const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const isDirectory = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory()
  } catch {
    return false
  }
}

const declaredPackageManager = async (cwd: string): Promise<PackageManager | null> => {
  const packageJsonPath = join(cwd, 'package.json')
  if (!await pathExists(packageJsonPath)) return null
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
    if (typeof packageJson.packageManager !== 'string') return null
    const manager = packageJson.packageManager.split('@')[0]
    return manager === 'pnpm' || manager === 'npm' || manager === 'yarn' || manager === 'bun'
      ? manager
      : null
  } catch {
    return null
  }
}

export const detectPackageManager = async (cwd: string): Promise<PackageManager> => {
  let directory = cwd
  while (true) {
    const declared = await declaredPackageManager(directory)
    if (declared) return declared
    if (await pathExists(join(directory, 'pnpm-lock.yaml'))) return 'pnpm'
    if (await pathExists(join(directory, 'yarn.lock'))) return 'yarn'
    if (await pathExists(join(directory, 'bun.lock')) || await pathExists(join(directory, 'bun.lockb'))) return 'bun'
    if (await pathExists(join(directory, 'package-lock.json'))) return 'npm'

    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  return 'npm'
}

const quoteTs = (value: string): string => JSON.stringify(value)

/**
 * How the generated component detects a production build.
 * - 'vite': `import.meta.env.DEV`. Stock Vite react-ts apps type-check with
 *   `types: ["vite/client"]` only, so `process` does not exist there and
 *   `tsc -b && vite build` would fail on `process.env`.
 * - 'node-env': `process.env.NODE_ENV`, which Next.js (App Router included),
 *   webpack and most other bundlers replace at build time.
 */
export type DevtoolsGuard = 'vite' | 'node-env'

export interface DevtoolsComponentOptions {
  /** Hub URL written as the widget's beaconUrl (default DEFAULT_HUB_URL). */
  readonly hubUrl?: string
  readonly guard?: DevtoolsGuard
}

const DEV_GUARDS: Readonly<Record<DevtoolsGuard, string>> = {
  vite: 'if (!import.meta.env.DEV) return null',
  'node-env': "if (process.env.NODE_ENV === 'production') return null",
}

export const renderDevtoolsComponent = (
  projectId: string,
  { hubUrl = DEFAULT_HUB_URL, guard = 'node-env' }: DevtoolsComponentOptions = {},
): string =>
  `'use client'\n\n`
  + `import { PerfToggle } from '${WIDGET_PACKAGE}'\n\n`
  + `export const VibeCheckDevtools = () => {\n`
  + `  ${DEV_GUARDS[guard]}\n\n`
  + `  return (\n`
  + `    <PerfToggle\n`
  + `      vibeCheckProps={{\n`
  + `        beaconUrl: ${quoteTs(normalizeHubUrl(hubUrl))},\n`
  + `        projectId: ${quoteTs(projectId)},\n`
  + `      }}\n`
  + `    />\n`
  + `  )\n`
  + `}\n`

const VITE_CONFIG_FILES = [
  'vite.config.ts',
  'vite.config.mts',
  'vite.config.cts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.cjs',
] as const

/** Next.js wins (import.meta.env does not exist there); then a declared vite or a vite config. */
export const detectDevtoolsGuard = async (
  cwd: string,
  packageJson: PackageJson,
): Promise<DevtoolsGuard> => {
  if (hasDeclaredPackage(packageJson, 'next')) return 'node-env'
  if (hasDeclaredPackage(packageJson, 'vite')) return 'vite'
  for (const file of VITE_CONFIG_FILES) {
    if (await pathExists(join(cwd, file))) return 'vite'
  }
  return 'node-env'
}

const installCommand = (manager: PackageManager, version: string): CommandSpec => {
  const packageSpec = `${WIDGET_PACKAGE}@${version}`
  if (manager === 'pnpm') return { command: 'pnpm', args: ['add', '--save-dev', packageSpec] }
  if (manager === 'yarn') return { command: 'yarn', args: ['add', '--dev', packageSpec] }
  if (manager === 'bun') return { command: 'bun', args: ['add', '--dev', packageSpec] }
  return { command: 'npm', args: ['install', '--save-dev', packageSpec] }
}

const commandText = ({ command, args }: CommandSpec): string => [command, ...args].join(' ')

const isDefaultHub = (hubUrl: string): boolean => normalizeHubUrl(hubUrl) === DEFAULT_HUB_URL

/** `VIBE_CHECK_HUB_URL=<url>` for a non-default hub; null for the default one. */
const hubEnvAssignment = (hubUrl: string): string | null =>
  isDefaultHub(hubUrl) ? null : `${HUB_URL_ENV}=${normalizeHubUrl(hubUrl)}`

// Argument order matches getAgentClientSetup(agent, { hubUrl }).value exactly.
const agentCommands = (agent: Exclude<SetupAgent, 'cursor'>, version: string, hubUrl: string): {
  readonly get: CommandSpec
  readonly add: CommandSpec
} => {
  const connect = ['npx', '-y', `${MCP_PACKAGE}@${version}`, 'connect']
  const env = hubEnvAssignment(hubUrl)
  if (agent === 'codex') {
    return {
      get: { command: 'codex', args: ['mcp', 'get', 'vibe-check', '--json'] },
      add: {
        command: 'codex',
        args: ['mcp', 'add', 'vibe-check', ...(env === null ? [] : ['--env', env]), '--', ...connect],
      },
    }
  }
  return {
    get: { command: 'claude', args: ['mcp', 'get', 'vibe-check'] },
    add: {
      command: 'claude',
      args: ['mcp', 'add', '--scope', 'local', 'vibe-check', ...(env === null ? [] : ['-e', env]), '--', ...connect],
    },
  }
}

// Arguments that need no quoting for cmd.exe; anything else is double-quoted.
const WINDOWS_PLAIN_ARG = /^[A-Za-z0-9@+:./_-]+$/
// Characters cmd.exe still interprets inside double quotes, plus a trailing
// backslash (it would escape the closing quote).
const WINDOWS_UNSAFE_ARG = /["%!\r\n]|\\$/

/** One command line for cmd.exe. Throws instead of guessing when an argument cannot be passed safely. */
export const windowsCommandLine = (command: string, args: readonly string[]): string =>
  [command, ...args].map((value) => {
    if (value.length === 0 || WINDOWS_UNSAFE_ARG.test(value)) {
      throw new Error(`Cannot pass ${JSON.stringify(value)} safely through cmd.exe`)
    }
    return WINDOWS_PLAIN_ARG.test(value) ? value : `"${value}"`
  }).join(' ')

export interface SpawnPlan {
  readonly file: string
  readonly args: readonly string[]
  readonly shell: boolean
}

/**
 * npm, pnpm, yarn, codex and claude are `.cmd` shims on Windows, which Node
 * only starts through a shell. There the whole command line is built with
 * quoting (no separate args, so nothing is concatenated unescaped). Other
 * platforms keep execFile without a shell.
 */
export const spawnPlan = (
  command: string,
  args: readonly string[],
  platform: NodeJS.Platform = process.platform,
): SpawnPlan => platform === 'win32'
  ? { file: windowsCommandLine(command, args), args: [], shell: true }
  : { file: command, args, shell: false }

export const defaultRunCommand: SetupCommandRunner = async (command, args, cwd) => {
  try {
    const plan = spawnPlan(command, args)
    await execFileAsync(plan.file, [...plan.args], { cwd, shell: plan.shell })
    return { exitCode: 0 }
  } catch (error) {
    const output = isRecord(error) ? error : {}
    const message = error instanceof Error ? error.message : String(error)
    const stderr = typeof output['stderr'] === 'string' ? output['stderr'].trim() : ''
    const stdout = typeof output['stdout'] === 'string' ? output['stdout'].trim() : ''
    return {
      exitCode: 1,
      error: [message, stderr, stdout].filter((value) => value.length > 0).join('\n'),
    }
  }
}

const commandFailure = (summary: string, result: SetupCommandResult): Error =>
  new Error(result.error ? `${summary}: ${result.error}` : summary)

const writeAtomic = async (path: string, content: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`)
  await writeFile(temporary, content)
  await rename(temporary, path)
}

const readCursorConfig = async (path: string): Promise<Readonly<Record<string, unknown>>> => {
  if (!await pathExists(path)) return {}
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (!isRecord(parsed)) throw new Error('root must be an object')
    return parsed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Cursor MCP config at ${path} must be valid JSON: ${message}`)
  }
}

const cursorConfig = (
  current: Readonly<Record<string, unknown>>,
  version: string,
  hubUrl: string,
): Readonly<Record<string, unknown>> => {
  const existingServers = isRecord(current['mcpServers']) ? current['mcpServers'] : {}
  const server = {
    command: 'npx',
    args: ['-y', `${MCP_PACKAGE}@${version}`, 'connect'],
  }
  return {
    ...current,
    mcpServers: {
      ...existingServers,
      'vibe-check': isDefaultHub(hubUrl)
        ? server
        : { ...server, env: { [HUB_URL_ENV]: normalizeHubUrl(hubUrl) } },
    },
  }
}

const packageProjectId = (packageJson: PackageJson): string => {
  if (typeof packageJson.name !== 'string' || packageJson.name.trim().length === 0) {
    throw new CliError('package.json has no name, so setup cannot pick a project ID.', 'Pass --project <id>.')
  }
  return packageJson.name
}

const readPackageJson = async (cwd: string): Promise<PackageJson> => {
  const path = join(cwd, 'package.json')
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (error) {
    if (isMissing(error)) {
      throw new CliError(`No package.json in ${cwd}.`, 'Run setup from your React app\'s folder (the one with package.json).')
    }
    throw error
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) throw new Error('the top level must be an object')
    return parsed
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new CliError(`package.json in ${cwd} is not valid JSON: ${message}`)
  }
}

const readJsonRecord = async (path: string): Promise<Readonly<Record<string, unknown>> | null> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

const nonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null

export interface LocalProjectIds {
  /** `projectId` from `.vibecheck/config.json` (written by setup). */
  readonly configProjectId: string | null
  /** `name` from package.json. */
  readonly packageName: string | null
}

/** The project IDs a folder declares for itself. Missing or malformed files read as null. */
export const readLocalProjectIds = async (cwd: string): Promise<LocalProjectIds> => {
  const [config, packageJson] = await Promise.all([
    readJsonRecord(join(cwd, '.vibecheck/config.json')),
    readJsonRecord(join(cwd, 'package.json')),
  ])
  return {
    configProjectId: nonEmptyString(config?.['projectId']),
    packageName: nonEmptyString(packageJson?.['name']),
  }
}

const addRuntimeIgnores = async (root: string): Promise<void> => {
  const path = join(root, '.gitignore')
  const current = await pathExists(path) ? await readFile(path, 'utf8') : ''
  if (current.includes('.vibecheck/state.json')) return
  const separator = current.length === 0 ? '' : current.endsWith('\n') ? '\n' : '\n\n'
  await writeAtomic(path, `${current}${separator}${GITIGNORE_BLOCK}\n`)
}

export const runSetup = async (
  options: SetupOptions,
  dependencies: SetupDependencies = {},
): Promise<SetupResult> => {
  const runCommand = dependencies.runCommand ?? defaultRunCommand
  const packageJson = await readPackageJson(options.cwd)
  if (!hasDeclaredPackage(packageJson, 'react')) {
    throw new CliError('VibeCheck setup currently requires a React project that declares react in package.json')
  }

  const hubUrl = normalizeHubUrl(options.hubUrl)
  const origins = options.origins ?? []
  const projectId = options.projectId ?? packageProjectId(packageJson)
  const manager = await detectPackageManager(options.cwd)
  const guard = await detectDevtoolsGuard(options.cwd, packageJson)
  const componentPath = await isDirectory(join(options.cwd, 'src'))
    ? 'src/VibeCheckDevtools.tsx'
    : 'VibeCheckDevtools.tsx'
  const componentAbsolutePath = join(options.cwd, componentPath)
  if (await pathExists(componentAbsolutePath) && !options.force) {
    throw new CliError(`${componentPath} already exists; rerun setup with --force to replace the generated component.`)
  }

  // Check the registry first, so a dry run reports the same conflict a real run would hit.
  const registryPath = process.env['VIBE_CHECK_REGISTRY_PATH'] ?? defaultProjectRegistryPath()
  const registeredRoot = await resolveProjectRoot(registryPath, projectId)
  const movesFrom = registeredRoot !== null
    && registeredRoot !== await realpath(options.cwd)
    && await pathExists(registeredRoot)
    ? registeredRoot
    : null
  const conflictHint = 'To move it here, rerun setup with --force. To keep both, pass a different --project.'
  if (movesFrom !== null && !options.force) throw new ProjectRootConflictError(projectId, movesFrom, conflictHint)

  const actions: string[] = []
  const widgetInstalled = hasDeclaredPackage(packageJson, WIDGET_PACKAGE)
  const install = installCommand(manager, options.version)
  actions.push(widgetInstalled
    ? `${WIDGET_PACKAGE} is already declared; skipped install`
    : commandText(install))
  actions.push(`${options.force ? 'Replace' : 'Create'} ${componentPath} (renders only in development, via ${
    guard === 'vite' ? 'import.meta.env.DEV' : 'process.env.NODE_ENV'
  })`)
  actions.push([
    movesFrom === null
      ? 'Create .vibecheck/config.json and register this project root'
      : `Create .vibecheck/config.json and move project "${projectId}" here from ${movesFrom}`,
    origins.length > 0 ? ` (allowed origins: ${origins.join(', ')})` : '',
  ].join(''))
  actions.push('Ignore .vibecheck runtime state')

  const cursorPath = join(options.cwd, '.cursor/mcp.json')
  const currentCursor = options.agent === 'cursor' ? await readCursorConfig(cursorPath) : null
  if (options.agent === 'cursor') {
    actions.push('Merge vibe-check into .cursor/mcp.json')
  } else {
    actions.push(commandText(agentCommands(options.agent, options.version, hubUrl).add))
  }

  const setup = getAgentClientSetup(options.agent, { hubUrl })
  if (!options.dryRun) {
    try {
      await registerProjectRoot(registryPath, projectId, options.cwd, { force: options.force, origins })
    } catch (error) {
      if (error instanceof ProjectRootConflictError) {
        throw new ProjectRootConflictError(projectId, error.existingRoot, conflictHint)
      }
      throw error
    }
    if (!widgetInstalled) {
      const installed = await runCommand(install.command, install.args, options.cwd)
      if (installed.exitCode !== 0) {
        throw commandFailure(`Widget install failed: ${commandText(install)}`, installed)
      }
    }

    if (options.agent === 'cursor') {
      await writeAtomic(cursorPath, `${JSON.stringify(cursorConfig(currentCursor ?? {}, options.version, hubUrl), null, 2)}\n`)
    } else {
      const commands = agentCommands(options.agent, options.version, hubUrl)
      const existing = await runCommand(commands.get.command, commands.get.args, options.cwd)
      if (existing.exitCode === 0) {
        const env = hubEnvAssignment(hubUrl)
        actions[actions.length - 1] = env === null
          ? 'vibe-check MCP server is already configured'
          : `vibe-check MCP server is already configured; make sure it sets ${env} (check with: ${setup.verifyCommand})`
      } else {
        const added = await runCommand(commands.add.command, commands.add.args, options.cwd)
        if (added.exitCode !== 0) {
          throw commandFailure(`Agent configuration failed: ${commandText(commands.add)}`, added)
        }
      }
    }

    await writeAtomic(join(options.cwd, '.vibecheck/config.json'), `${JSON.stringify({
      schemaVersion: 1,
      projectId,
    }, null, 2)}\n`)
    await addRuntimeIgnores(options.cwd)
    await writeAtomic(componentAbsolutePath, renderDevtoolsComponent(projectId, { hubUrl, guard }))
  }

  const packageSpec = `${MCP_PACKAGE}@${options.version}`
  const port = hubPortFromUrl(hubUrl)
  const portFlag = port !== null && port !== DEFAULT_HUB_PORT ? ` --port ${port}` : ''
  return {
    projectId,
    componentPath: relative(options.cwd, componentAbsolutePath),
    actions,
    nextSteps: [
      `Mount <VibeCheckDevtools /> once near your React app root from ${componentPath}.`,
      `Start the guided hub: npx -y ${packageSpec} up --project ${projectId} --agent ${options.agent}${portFlag}`,
      `Restart or open a new ${setup.label} session, then verify: ${setup.verifyCommand}`,
      getWatchInstruction(projectId),
    ],
  }
}
