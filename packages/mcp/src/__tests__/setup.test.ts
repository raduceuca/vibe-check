import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { MCP_PACKAGE_VERSION, getAgentClientSetup } from '@wcgw/vibe-check-protocol'
import {
  defaultRunCommand,
  detectDevtoolsGuard,
  detectPackageManager,
  readLocalProjectIds,
  renderDevtoolsComponent,
  runSetup,
  spawnPlan,
  windowsCommandLine,
  type SetupCommandRunner,
} from '../setup.js'
import { ProjectRootConflictError, readProjectRegistry, registerProjectRoot } from '../projectRegistry.js'
import { CliError } from '../fatal.js'

interface CommandCall {
  readonly command: string
  readonly args: readonly string[]
  readonly cwd: string
}

const withProject = async (
  packageJson: Readonly<Record<string, unknown>>,
  run: (root: string) => Promise<void>,
): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'vibe-check-setup-'))
  const previousRegistry = process.env['VIBE_CHECK_REGISTRY_PATH']
  process.env['VIBE_CHECK_REGISTRY_PATH'] = join(root, 'user-projects.json')
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify(packageJson, null, 2))
    await run(root)
  } finally {
    if (previousRegistry === undefined) delete process.env['VIBE_CHECK_REGISTRY_PATH']
    else process.env['VIBE_CHECK_REGISTRY_PATH'] = previousRegistry
    await rm(root, { recursive: true, force: true })
  }
}

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const recordingRunner = (
  calls: CommandCall[],
  result: (command: string, args: readonly string[]) => number = () => 0,
): SetupCommandRunner => async (command, args, cwd) => {
  calls.push({ command, args, cwd })
  return { exitCode: result(command, args) }
}

describe('detectPackageManager', () => {
  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lock', 'bun'],
    ['bun.lockb', 'bun'],
    ['package-lock.json', 'npm'],
  ] as const)('detects %s as %s', async (lockfile, expected) => {
    await withProject({ name: 'fixture', dependencies: { react: '^19.0.0' } }, async (root) => {
      await writeFile(join(root, lockfile), '')
      await expect(detectPackageManager(root)).resolves.toBe(expected)
    })
  })

  it('falls back to npm when no lockfile exists', async () => {
    await withProject({ name: 'fixture', dependencies: { react: '^19.0.0' } }, async (root) => {
      await expect(detectPackageManager(root)).resolves.toBe('npm')
    })
  })

  it.each([
    ['pnpm-lock.yaml', 'pnpm'],
    ['yarn.lock', 'yarn'],
    ['bun.lockb', 'bun'],
  ] as const)('detects ancestor %s for a nested workspace project', async (lockfile, expected) => {
    await withProject({ name: 'workspace-root', private: true }, async (root) => {
      const app = join(root, 'packages/storefront')
      await mkdir(app, { recursive: true })
      await writeFile(join(app, 'package.json'), JSON.stringify({
        name: 'storefront',
        dependencies: { react: '^19.0.0' },
      }))
      await writeFile(join(root, lockfile), '')

      await expect(detectPackageManager(app)).resolves.toBe(expected)
    })
  })

  it('prefers the nearest packageManager declaration over an ancestor lockfile', async () => {
    await withProject({ name: 'workspace-root', private: true }, async (root) => {
      const app = join(root, 'packages/storefront')
      await mkdir(app, { recursive: true })
      await writeFile(join(root, 'pnpm-lock.yaml'), '')
      await writeFile(join(app, 'package.json'), JSON.stringify({
        name: 'storefront',
        packageManager: 'yarn@4.9.2',
        dependencies: { react: '^19.0.0' },
      }))

      await expect(detectPackageManager(app)).resolves.toBe('yarn')
    })
  })
})

describe('renderDevtoolsComponent', () => {
  it('renders a named React component with the selected project and local hub', () => {
    const source = renderDevtoolsComponent('my-storefront')

    expect(source).toContain("export const VibeCheckDevtools")
    expect(source).toContain('projectId: "my-storefront"')
    expect(source).toContain('beaconUrl: "http://127.0.0.1:4200"')
    expect(source).toContain("process.env.NODE_ENV === 'production'")
    expect(source).toContain('return null')
    expect(source).not.toContain('export default')
  })

  it('serializes unusual project IDs as valid TypeScript string literals', () => {
    const projectId = "store'\\front\nline\rseparator\u2028end"
    const source = renderDevtoolsComponent(projectId)

    expect(source).toContain(`projectId: ${JSON.stringify(projectId)}`)
  })
})

describe('runSetup', () => {
  it('returns a portable failure result when the command is missing', async () => {
    const result = await defaultRunCommand('vibe-check-command-that-does-not-exist', [], process.cwd())

    expect(result.exitCode).not.toBe(0)
    expect(result.error).toBeTruthy()
  })

  it('rejects projects that do not declare React', async () => {
    await withProject({ name: 'not-react' }, async (root) => {
      await expect(runSetup({
        cwd: root,
        agent: 'codex',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner([]) })).rejects.toThrow('React project')
    })
  })

  it('reports a complete dry run without files or commands', async () => {
    await withProject({ name: 'storefront', dependencies: { react: '^19.0.0' } }, async (root) => {
      await mkdir(join(root, 'src'))
      await writeFile(join(root, 'pnpm-lock.yaml'), '')
      const calls: CommandCall[] = []

      const result = await runSetup({
        cwd: root,
        agent: 'codex',
        version: MCP_PACKAGE_VERSION,
        dryRun: true,
        force: false,
      }, { runCommand: recordingRunner(calls) })

      expect(calls).toEqual([])
      expect(await exists(join(root, 'src/VibeCheckDevtools.tsx'))).toBe(false)
      expect(result.projectId).toBe('storefront')
      expect(result.actions.join('\n')).toContain(`pnpm add --save-dev @wcgw/vibe-check@${MCP_PACKAGE_VERSION}`)
      expect(result.actions.join('\n')).toContain('codex mcp add vibe-check')
      expect(result.nextSteps.join('\n')).toContain('watch_for_issue')
    })
  })

  it('includes the underlying install failure in the setup error', async () => {
    await withProject({ name: 'storefront', dependencies: { react: '^19.0.0' } }, async (root) => {
      await expect(runSetup({
        cwd: root,
        agent: 'codex',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, {
        runCommand: async () => ({ exitCode: 1, error: 'registry connection timed out' }),
      })).rejects.toThrow('registry connection timed out')
    })
  })

  it('can retry normally after agent configuration fails', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      let addFails = true
      const runner: SetupCommandRunner = async (_command, args) => {
        if (args.includes('get')) return { exitCode: 1 }
        return addFails
          ? { exitCode: 1, error: 'agent config write failed' }
          : { exitCode: 0 }
      }
      const options = {
        cwd: root,
        agent: 'codex' as const,
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }

      await expect(runSetup(options, { runCommand: runner })).rejects.toThrow('agent config write failed')
      expect(await exists(join(root, 'VibeCheckDevtools.tsx'))).toBe(false)

      addFails = false
      await expect(runSetup(options, { runCommand: runner })).resolves.toMatchObject({ projectId: 'storefront' })
      expect(await exists(join(root, 'VibeCheckDevtools.tsx'))).toBe(true)
    })
  })

  it('installs the widget, generates the component, and configures Codex', async () => {
    await withProject({ name: '@acme/storefront', dependencies: { react: '^19.0.0' } }, async (root) => {
      await mkdir(join(root, 'src'))
      await writeFile(join(root, 'pnpm-lock.yaml'), '')
      const calls: CommandCall[] = []
      const runner = recordingRunner(calls, (_command, args) => args.includes('get') ? 1 : 0)

      const result = await runSetup({
        cwd: root,
        agent: 'codex',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: runner })

      const source = await readFile(join(root, 'src/VibeCheckDevtools.tsx'), 'utf8')
      expect(source).toContain('projectId: "@acme/storefront"')
      expect(calls.map(({ command, args }) => [command, ...args])).toEqual([
        ['pnpm', 'add', '--save-dev', `@wcgw/vibe-check@${MCP_PACKAGE_VERSION}`],
        ['codex', 'mcp', 'get', 'vibe-check', '--json'],
        ['codex', 'mcp', 'add', 'vibe-check', '--', 'npx', '-y', `@wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION}`, 'connect'],
      ])
      expect(result.componentPath).toBe('src/VibeCheckDevtools.tsx')
    })
  })

  it('writes commit-safe project config, ignores runtime state, and registers the root', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      await writeFile(join(root, '.gitignore'), 'node_modules\n')
      await runSetup({
        cwd: root,
        agent: 'codex',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner([]) })

      await expect(readFile(join(root, '.vibecheck/config.json'), 'utf8')).resolves.toContain(
        '"projectId": "storefront"',
      )
      await expect(readFile(join(root, '.gitignore'), 'utf8')).resolves.toBe(
        'node_modules\n\n# VibeCheck runtime state\n.vibecheck/state.json\n'
        + '.vibecheck/state.json.corrupt-*\n.vibecheck/*.tmp\n',
      )
      await expect(readProjectRegistry(join(root, 'user-projects.json'))).resolves.toMatchObject({
        projects: { storefront: { root: expect.stringContaining(root.split('/').at(-1)!) } },
      })
    })
  })

  it('skips an installed widget and an existing Codex server', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0' },
      devDependencies: { '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      const calls: CommandCall[] = []

      const result = await runSetup({
        cwd: root,
        agent: 'codex',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner(calls) })

      expect(calls.map(({ command, args }) => [command, ...args])).toEqual([
        ['codex', 'mcp', 'get', 'vibe-check', '--json'],
      ])
      expect(result.actions.join('\n')).toContain('already declared; skipped install')
      expect(result.actions.join('\n')).toContain('already configured')
    })
  })

  it('refuses an existing component unless force is supplied', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      await writeFile(join(root, 'VibeCheckDevtools.tsx'), 'keep me')
      const options = {
        cwd: root,
        agent: 'codex' as const,
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }

      await expect(runSetup(options, { runCommand: recordingRunner([]) })).rejects.toThrow('--force')
      await runSetup({ ...options, force: true }, { runCommand: recordingRunner([]) })
      await expect(readFile(join(root, 'VibeCheckDevtools.tsx'), 'utf8')).resolves.toContain('VibeCheckDevtools')
    })
  })

  it('merges Cursor configuration without removing existing servers', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      await mkdir(join(root, '.cursor'))
      await writeFile(join(root, '.cursor/mcp.json'), JSON.stringify({
        mcpServers: { existing: { command: 'existing-server' } },
        theme: 'dark',
      }))

      await runSetup({
        cwd: root,
        agent: 'cursor',
        projectId: 'storefront-web',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner([]) })

      const config = JSON.parse(await readFile(join(root, '.cursor/mcp.json'), 'utf8'))
      expect(config.theme).toBe('dark')
      expect(config.mcpServers.existing).toEqual({ command: 'existing-server' })
      expect(config.mcpServers['vibe-check']).toEqual({
        command: 'npx',
        args: ['-y', `@wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION}`, 'connect'],
      })
      await expect(readFile(join(root, 'VibeCheckDevtools.tsx'), 'utf8')).resolves.toContain('projectId: "storefront-web"')
    })
  })

  it('rejects malformed Cursor JSON instead of replacing it', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      await mkdir(join(root, '.cursor'))
      await writeFile(join(root, '.cursor/mcp.json'), '{ broken')

      await expect(runSetup({
        cwd: root,
        agent: 'cursor',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner([]) })).rejects.toThrow('valid JSON')
      await expect(readFile(join(root, '.cursor/mcp.json'), 'utf8')).resolves.toBe('{ broken')
    })
  })

  it('uses Claude local scope and the matching MCP version', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      const calls: CommandCall[] = []
      const runner = recordingRunner(calls, (_command, args) => args.includes('get') ? 1 : 0)

      await runSetup({
        cwd: root,
        agent: 'claude-code',
        version: MCP_PACKAGE_VERSION,
        dryRun: false,
        force: false,
      }, { runCommand: runner })

      expect(calls.map(({ command, args }) => [command, ...args])).toEqual([
        ['claude', 'mcp', 'get', 'vibe-check'],
        ['claude', 'mcp', 'add', '--scope', 'local', 'vibe-check', '--', 'npx', '-y', `@wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION}`, 'connect'],
      ])
    })
  })
})

// ── P6: the generated component type-checks where it is mounted ─────────────

// Minimal stand-ins for react/jsx-runtime and the widget, so the check needs no
// installed React types. Only the guard line differs between the variants.
const TYPE_STUBS = `
declare module 'react/jsx-runtime' {
  export namespace JSX {
    interface Element { readonly element: true }
    interface IntrinsicElements { readonly [name: string]: unknown }
  }
  export const jsx: (type: unknown, props: unknown) => JSX.Element
  export const jsxs: (type: unknown, props: unknown) => JSX.Element
  export const Fragment: unique symbol
}
declare module '@wcgw/vibe-check' {
  export interface VibeCheckProps { readonly beaconUrl?: string; readonly projectId?: string }
  export const PerfToggle: (props: { readonly vibeCheckProps?: VibeCheckProps }) => import('react/jsx-runtime').JSX.Element
}
`
// What a stock Vite react-ts app has: "types": ["vite/client"] and no Node types.
const VITE_CLIENT_TYPES = `
interface ImportMetaEnv { readonly DEV: boolean; readonly PROD: boolean; readonly MODE: string }
interface ImportMeta { readonly env: ImportMetaEnv }
`
// What a create-next-app project has through @types/node.
const NODE_PROCESS_TYPES = `
declare const process: { readonly env: { readonly NODE_ENV?: 'development' | 'production' | 'test' } }
`

const typeCheck = (source: string, ambientTypes: string): readonly string[] => {
  const files = new Map<string, string>([
    ['/app/src/VibeCheckDevtools.tsx', source],
    ['/app/src/stubs.d.ts', TYPE_STUBS],
    ['/app/src/env.d.ts', ambientTypes],
  ])
  // Mirrors the compiler options of create-vite's react-ts tsconfig.app.json.
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force,
    jsx: ts.JsxEmit.ReactJSX,
    types: [],
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    verbatimModuleSyntax: true,
    noUnusedLocals: true,
    noUnusedParameters: true,
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  const fileExists = host.fileExists.bind(host)
  const readFile = host.readFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const content = files.get(fileName)
    return content === undefined
      ? getSourceFile(fileName, languageVersion, onError, shouldCreate)
      : ts.createSourceFile(fileName, content, languageVersion, true)
  }
  host.fileExists = (fileName) => files.has(fileName) || fileExists(fileName)
  host.readFile = (fileName) => files.get(fileName) ?? readFile(fileName)
  const program = ts.createProgram([...files.keys()], options, host)
  return ts.getPreEmitDiagnostics(program).map((diagnostic) =>
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
}

describe('generated component type-checks in the host framework (P6)', () => {
  it('passes a Vite react-ts check (vite/client types only) with the Vite guard', () => {
    const source = renderDevtoolsComponent('my-storefront', { guard: 'vite' })

    expect(source).toContain('if (!import.meta.env.DEV) return null')
    expect(source).not.toContain('process')
    expect(typeCheck(source, VITE_CLIENT_TYPES)).toEqual([])
  })

  it('reproduces the 0.3 failure: the process.env guard does not type-check under vite/client', () => {
    const diagnostics = typeCheck(renderDevtoolsComponent('my-storefront', { guard: 'node-env' }), VITE_CLIENT_TYPES)

    expect(diagnostics.join('\n')).toContain("Cannot find name 'process'")
  })

  it('keeps the process.env guard type-checking where Node types exist (Next.js)', () => {
    expect(typeCheck(renderDevtoolsComponent('my-storefront'), NODE_PROCESS_TYPES)).toEqual([])
  })
})

describe('detectDevtoolsGuard', () => {
  it.each([
    [{ name: 'vite-app', dependencies: { react: '^19.0.0' }, devDependencies: { vite: '^7.0.0' } }, [], 'vite'],
    [{ name: 'vite-config-only', dependencies: { react: '^19.0.0' } }, ['vite.config.ts'], 'vite'],
    [{ name: 'next-app', dependencies: { react: '^19.0.0', next: '^16.0.0' }, devDependencies: { vite: '^7.0.0' } }, [], 'node-env'],
    [{ name: 'webpack-app', dependencies: { react: '^19.0.0' } }, [], 'node-env'],
  ] as const)('picks the guard for %j', async (packageJson, files, expected) => {
    await withProject(packageJson, async (root) => {
      for (const file of files) await writeFile(join(root, file), 'export default {}\n')
      await expect(detectDevtoolsGuard(root, packageJson)).resolves.toBe(expected)
    })
  })

  it('writes the Vite guard into a Vite project and the NODE_ENV guard into a Next.js project', async () => {
    await withProject({
      name: 'vite-app',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
      devDependencies: { vite: '^7.0.0' },
    }, async (root) => {
      const result = await runSetup({
        cwd: root, agent: 'cursor', version: MCP_PACKAGE_VERSION, dryRun: false, force: false,
      }, { runCommand: recordingRunner([]) })
      await expect(readFile(join(root, 'VibeCheckDevtools.tsx'), 'utf8')).resolves.toContain('if (!import.meta.env.DEV) return null')
      expect(result.actions.join('\n')).toContain('via import.meta.env.DEV')
    })
    await withProject({
      name: 'next-app',
      dependencies: { react: '^19.0.0', next: '^16.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` },
    }, async (root) => {
      await runSetup({
        cwd: root, agent: 'cursor', version: MCP_PACKAGE_VERSION, dryRun: false, force: false,
      }, { runCommand: recordingRunner([]) })
      const source = await readFile(join(root, 'VibeCheckDevtools.tsx'), 'utf8')
      expect(source.startsWith("'use client'\n")).toBe(true)
      expect(source).toContain("if (process.env.NODE_ENV === 'production') return null")
    })
  })
})

describe('setup with a non-default hub (E2E-06)', () => {
  const reactProject = { name: 'storefront', dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` } }

  it.each(['codex', 'claude-code'] as const)('configures %s with the same command the protocol prints', async (agent) => {
    for (const hubUrl of ['http://127.0.0.1:4200', 'http://127.0.0.1:4317']) {
      await withProject(reactProject, async (root) => {
        const calls: CommandCall[] = []
        await runSetup({
          cwd: root, agent, version: MCP_PACKAGE_VERSION, dryRun: false, force: false, hubUrl,
        }, { runCommand: recordingRunner(calls, (_command, args) => args.includes('get') ? 1 : 0) })

        const add = calls.find(({ args }) => args.includes('add'))
        expect(add && [add.command, ...add.args].join(' ')).toBe(getAgentClientSetup(agent, { hubUrl }).value)
      })
    }
  })

  it('writes the port into the component, the next steps, and the agent config', async () => {
    await withProject(reactProject, async (root) => {
      const calls: CommandCall[] = []
      const result = await runSetup({
        cwd: root, agent: 'claude-code', version: MCP_PACKAGE_VERSION, dryRun: false, force: false,
        hubUrl: 'http://127.0.0.1:4317',
      }, { runCommand: recordingRunner(calls, (_command, args) => args.includes('get') ? 1 : 0) })

      await expect(readFile(join(root, 'VibeCheckDevtools.tsx'), 'utf8')).resolves.toContain('beaconUrl: "http://127.0.0.1:4317"')
      expect(calls.at(-1)?.args).toEqual([
        'mcp', 'add', '--scope', 'local', 'vibe-check', '-e', 'VIBE_CHECK_HUB_URL=http://127.0.0.1:4317',
        '--', 'npx', '-y', `@wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION}`, 'connect',
      ])
      expect(result.nextSteps).toContain(
        `Start the guided hub: npx -y @wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION} up --project storefront --agent claude-code --port 4317`,
      )
    })
  })

  it('adds the hub env to the Cursor entry', async () => {
    await withProject(reactProject, async (root) => {
      await runSetup({
        cwd: root, agent: 'cursor', version: MCP_PACKAGE_VERSION, dryRun: false, force: false, hubUrl: 'http://127.0.0.1:4317',
      }, { runCommand: recordingRunner([]) })

      const config = JSON.parse(await readFile(join(root, '.cursor/mcp.json'), 'utf8'))
      expect(config.mcpServers['vibe-check']).toEqual({
        command: 'npx',
        args: ['-y', `@wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION}`, 'connect'],
        env: { VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4317' },
      })
    })
  })

  it('says to check the hub env when the agent already has a vibe-check server', async () => {
    await withProject(reactProject, async (root) => {
      const result = await runSetup({
        cwd: root, agent: 'codex', version: MCP_PACKAGE_VERSION, dryRun: false, force: false, hubUrl: 'http://127.0.0.1:4317',
      }, { runCommand: recordingRunner([]) })

      expect(result.actions.at(-1)).toBe(
        'vibe-check MCP server is already configured; make sure it sets VIBE_CHECK_HUB_URL=http://127.0.0.1:4317 (check with: codex mcp get vibe-check --json)',
      )
    })
  })
})

describe('setup messages and registry handling', () => {
  it('names the agent by its label in the next steps (E2E-16)', async () => {
    await withProject({ name: 'storefront', dependencies: { react: '^19.0.0' } }, async (root) => {
      const claude = await runSetup({
        cwd: root, agent: 'claude-code', version: MCP_PACKAGE_VERSION, dryRun: true, force: false,
      }, { runCommand: recordingRunner([]) })
      const cursor = await runSetup({
        cwd: root, agent: 'cursor', version: MCP_PACKAGE_VERSION, dryRun: true, force: false,
      }, { runCommand: recordingRunner([]) })

      expect(claude.nextSteps[2]).toBe('Restart or open a new Claude Code session, then verify: claude mcp get vibe-check')
      expect(cursor.nextSteps[2]).toBe('Restart or open a new Cursor session, then verify: cursor-agent mcp list-tools vibe-check')
    })
  })

  it('explains a missing or broken package.json instead of leaking ENOENT', async () => {
    const empty = await mkdtemp(join(tmpdir(), 'vibe-check-setup-empty-'))
    try {
      const missing = await runSetup({
        cwd: empty, agent: 'codex', version: MCP_PACKAGE_VERSION, dryRun: true, force: false,
      }).catch((error: unknown) => error)
      expect(missing).toBeInstanceOf(CliError)
      expect((missing as CliError).message).toBe(`No package.json in ${empty}.`)
      expect((missing as CliError).hint).toContain('React app')

      await writeFile(join(empty, 'package.json'), '{ nope')
      await expect(runSetup({
        cwd: empty, agent: 'codex', version: MCP_PACKAGE_VERSION, dryRun: true, force: false,
      })).rejects.toThrow(`package.json in ${empty} is not valid JSON`)
    } finally {
      await rm(empty, { recursive: true, force: true })
    }
  })

  it('reports a project ID registered at another folder, even in a dry run, and moves it with --force (MCP-10)', async () => {
    await withProject({ name: 'storefront', dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` } }, async (root) => {
      const otherCheckout = join(root, 'other-checkout')
      await mkdir(otherCheckout)
      await registerProjectRoot(join(root, 'user-projects.json'), 'storefront', otherCheckout)
      const options = { cwd: root, agent: 'codex' as const, version: MCP_PACKAGE_VERSION, force: false }

      for (const dryRun of [true, false]) {
        const error = await runSetup({ ...options, dryRun }, { runCommand: recordingRunner([]) })
          .catch((value: unknown) => value)
        expect(error).toBeInstanceOf(ProjectRootConflictError)
        expect((error as ProjectRootConflictError).hint).toContain('rerun setup with --force')
      }
      expect(await exists(join(root, 'VibeCheckDevtools.tsx'))).toBe(false)

      const result = await runSetup({ ...options, dryRun: false, force: true }, { runCommand: recordingRunner([]) })
      expect(result.actions.join('\n')).toContain(`move project "storefront" here from ${await realpath(otherCheckout)}`)
      await expect(readProjectRegistry(join(root, 'user-projects.json'))).resolves.toMatchObject({
        projects: { storefront: { root: await realpath(root) } },
      })
    })
  })

  it('registers --origin values with the project', async () => {
    await withProject({ name: 'storefront', dependencies: { react: '^19.0.0', '@wcgw/vibe-check': `^${MCP_PACKAGE_VERSION}` } }, async (root) => {
      const result = await runSetup({
        cwd: root, agent: 'codex', version: MCP_PACKAGE_VERSION, dryRun: false, force: false, origins: ['http://storefront.test:3000'],
      }, { runCommand: recordingRunner([]) })

      expect(result.actions.join('\n')).toContain('(allowed origins: http://storefront.test:3000)')
      await expect(readProjectRegistry(join(root, 'user-projects.json'))).resolves.toMatchObject({
        projects: { storefront: { origins: ['http://storefront.test:3000'] } },
      })
    })
  })
})

describe('readLocalProjectIds', () => {
  it('reads .vibecheck/config.json and the package.json name, tolerating missing files', async () => {
    await withProject({ name: 'acme-storefront' }, async (root) => {
      await expect(readLocalProjectIds(root)).resolves.toEqual({ configProjectId: null, packageName: 'acme-storefront' })
      await mkdir(join(root, '.vibecheck'))
      await writeFile(join(root, '.vibecheck/config.json'), JSON.stringify({ schemaVersion: 1, projectId: 'storefront' }))
      await expect(readLocalProjectIds(root)).resolves.toEqual({ configProjectId: 'storefront', packageName: 'acme-storefront' })
    })
    await expect(readLocalProjectIds(join(tmpdir(), 'vibe-check-does-not-exist'))).resolves.toEqual({
      configProjectId: null,
      packageName: null,
    })
  })
})

describe('Windows-safe command spawning (MCP-11)', () => {
  it('runs .cmd shims through cmd.exe with one quoted command line on win32', () => {
    expect(spawnPlan('codex', [
      'mcp', 'add', 'vibe-check', '--env', 'VIBE_CHECK_HUB_URL=http://127.0.0.1:4317', '--', 'npx', '-y', `@wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION}`, 'connect',
    ], 'win32')).toEqual({
      file: `codex mcp add vibe-check --env "VIBE_CHECK_HUB_URL=http://127.0.0.1:4317" -- npx -y @wcgw/vibe-check-mcp@${MCP_PACKAGE_VERSION} connect`,
      args: [],
      shell: true,
    })
    expect(spawnPlan('pnpm', ['add', '--save-dev', `@wcgw/vibe-check@${MCP_PACKAGE_VERSION}`], 'win32').file)
      .toBe(`pnpm add --save-dev @wcgw/vibe-check@${MCP_PACKAGE_VERSION}`)
  })

  it('keeps execFile without a shell elsewhere', () => {
    expect(spawnPlan('npm', ['install', '--save-dev', `@wcgw/vibe-check@${MCP_PACKAGE_VERSION}`], 'darwin')).toEqual({
      file: 'npm',
      args: ['install', '--save-dev', `@wcgw/vibe-check@${MCP_PACKAGE_VERSION}`],
      shell: false,
    })
  })

  it('refuses arguments cmd.exe would reinterpret instead of guessing', () => {
    expect(windowsCommandLine('npm', ['install', 'a b'])).toBe('npm install "a b"')
    for (const unsafe of ['%PATH%', 'say "hi"', 'bang!', 'dir\\', 'line\nbreak', '']) {
      expect(() => windowsCommandLine('npm', [unsafe])).toThrow('safely through cmd.exe')
    }
  })
})
