import { execFile } from 'node:child_process'
import {
  access,
  mkdir,
  readFile,
  rename,
  stat,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import type { SetupAgent } from './cli.js'
import { getWatchInstruction } from './types.js'
import {
  defaultProjectRegistryPath,
  registerProjectRoot,
} from './projectRegistry.js'

const execFileAsync = promisify(execFile)
const WIDGET_PACKAGE = '@wcgw/vibe-check'
const MCP_PACKAGE = '@wcgw/vibe-check-mcp'
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
  readonly force: boolean
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

export const renderDevtoolsComponent = (projectId: string): string =>
  `'use client'\n\n`
  + `import { PerfToggle } from '${WIDGET_PACKAGE}'\n\n`
  + `export const VibeCheckDevtools = () => {\n`
  + `  if (process.env.NODE_ENV === 'production') return null\n\n`
  + `  return (\n`
  + `    <PerfToggle\n`
  + `      vibeCheckProps={{\n`
  + `        beaconUrl: 'http://127.0.0.1:4200',\n`
  + `        projectId: ${quoteTs(projectId)},\n`
  + `      }}\n`
  + `    />\n`
  + `  )\n`
  + `}\n`

const installCommand = (manager: PackageManager, version: string): CommandSpec => {
  const packageSpec = `${WIDGET_PACKAGE}@${version}`
  if (manager === 'pnpm') return { command: 'pnpm', args: ['add', '--save-dev', packageSpec] }
  if (manager === 'yarn') return { command: 'yarn', args: ['add', '--dev', packageSpec] }
  if (manager === 'bun') return { command: 'bun', args: ['add', '--dev', packageSpec] }
  return { command: 'npm', args: ['install', '--save-dev', packageSpec] }
}

const commandText = ({ command, args }: CommandSpec): string => [command, ...args].join(' ')

const agentCommands = (agent: Exclude<SetupAgent, 'cursor'>, version: string): {
  readonly get: CommandSpec
  readonly add: CommandSpec
  readonly verify: string
} => {
  const packageSpec = `${MCP_PACKAGE}@${version}`
  if (agent === 'codex') {
    return {
      get: { command: 'codex', args: ['mcp', 'get', 'vibe-check', '--json'] },
      add: {
        command: 'codex',
        args: ['mcp', 'add', 'vibe-check', '--', 'npx', '-y', packageSpec, 'connect'],
      },
      verify: 'codex mcp get vibe-check --json',
    }
  }
  return {
    get: { command: 'claude', args: ['mcp', 'get', 'vibe-check'] },
    add: {
      command: 'claude',
      args: ['mcp', 'add', '--scope', 'local', 'vibe-check', '--', 'npx', '-y', packageSpec, 'connect'],
    },
    verify: 'claude mcp get vibe-check',
  }
}

export const defaultRunCommand: SetupCommandRunner = async (command, args, cwd) => {
  try {
    await execFileAsync(command, [...args], { cwd })
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
): Readonly<Record<string, unknown>> => {
  const existingServers = isRecord(current['mcpServers']) ? current['mcpServers'] : {}
  return {
    ...current,
    mcpServers: {
      ...existingServers,
      'vibe-check': {
        command: 'npx',
        args: ['-y', `${MCP_PACKAGE}@${version}`, 'connect'],
      },
    },
  }
}

const packageProjectId = (packageJson: PackageJson): string => {
  if (typeof packageJson.name !== 'string' || packageJson.name.trim().length === 0) {
    throw new Error('package.json needs a non-empty name or setup needs --project <id>')
  }
  return packageJson.name
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
  const packageJsonPath = join(options.cwd, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as PackageJson
  if (!hasDeclaredPackage(packageJson, 'react')) {
    throw new Error('VibeCheck setup currently requires a React project that declares react in package.json')
  }

  const projectId = options.projectId ?? packageProjectId(packageJson)
  const manager = await detectPackageManager(options.cwd)
  const componentPath = await isDirectory(join(options.cwd, 'src'))
    ? 'src/VibeCheckDevtools.tsx'
    : 'VibeCheckDevtools.tsx'
  const componentAbsolutePath = join(options.cwd, componentPath)
  if (await pathExists(componentAbsolutePath) && !options.force) {
    throw new Error(`${componentPath} already exists; rerun with --force to replace the generated component`)
  }

  const actions: string[] = []
  const widgetInstalled = hasDeclaredPackage(packageJson, WIDGET_PACKAGE)
  const install = installCommand(manager, options.version)
  actions.push(widgetInstalled
    ? `${WIDGET_PACKAGE} is already declared; skipped install`
    : commandText(install))
  actions.push(`${options.force ? 'Replace' : 'Create'} ${componentPath}`)
  actions.push('Create .vibecheck/config.json and register this project root')
  actions.push('Ignore .vibecheck runtime state')

  const cursorPath = join(options.cwd, '.cursor/mcp.json')
  const currentCursor = options.agent === 'cursor' ? await readCursorConfig(cursorPath) : null
  if (options.agent === 'cursor') {
    actions.push('Merge vibe-check into .cursor/mcp.json')
  } else {
    actions.push(commandText(agentCommands(options.agent, options.version).add))
  }

  if (!options.dryRun) {
    await registerProjectRoot(
      process.env['VIBE_CHECK_REGISTRY_PATH'] ?? defaultProjectRegistryPath(),
      projectId,
      options.cwd,
    )
    if (!widgetInstalled) {
      const installed = await runCommand(install.command, install.args, options.cwd)
      if (installed.exitCode !== 0) {
        throw commandFailure(`Widget install failed: ${commandText(install)}`, installed)
      }
    }

    if (options.agent === 'cursor') {
      await writeAtomic(cursorPath, `${JSON.stringify(cursorConfig(currentCursor ?? {}, options.version), null, 2)}\n`)
    } else {
      const commands = agentCommands(options.agent, options.version)
      const existing = await runCommand(commands.get.command, commands.get.args, options.cwd)
      if (existing.exitCode === 0) {
        actions[actions.length - 1] = 'vibe-check MCP server is already configured'
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
    await writeAtomic(componentAbsolutePath, renderDevtoolsComponent(projectId))
  }

  const packageSpec = `${MCP_PACKAGE}@${options.version}`
  const verify = options.agent === 'cursor'
    ? 'cursor-agent mcp list-tools vibe-check'
    : agentCommands(options.agent, options.version).verify
  return {
    projectId,
    componentPath: relative(options.cwd, componentAbsolutePath),
    actions,
    nextSteps: [
      `Mount <VibeCheckDevtools /> once near your React app root from ${componentPath}.`,
      `Start the shared hub: npx -y ${packageSpec} hub`,
      `Restart or open a new ${options.agent} agent session, then verify: ${verify}`,
      getWatchInstruction(projectId),
    ],
  }
}
