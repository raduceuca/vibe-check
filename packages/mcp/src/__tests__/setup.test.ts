import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  detectPackageManager,
  renderDevtoolsComponent,
  runSetup,
  type SetupCommandRunner,
} from '../setup.js'

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
  try {
    await writeFile(join(root, 'package.json'), JSON.stringify(packageJson, null, 2))
    await run(root)
  } finally {
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
})

describe('renderDevtoolsComponent', () => {
  it('renders a named React component with the selected project and local hub', () => {
    const source = renderDevtoolsComponent('my-storefront')

    expect(source).toContain("export const VibeCheckDevtools")
    expect(source).toContain("projectId: 'my-storefront'")
    expect(source).toContain("beaconUrl: 'http://127.0.0.1:4200'")
    expect(source).not.toContain('export default')
  })
})

describe('runSetup', () => {
  it('rejects projects that do not declare React', async () => {
    await withProject({ name: 'not-react' }, async (root) => {
      await expect(runSetup({
        cwd: root,
        agent: 'codex',
        version: '0.3.0',
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
        version: '0.3.0',
        dryRun: true,
        force: false,
      }, { runCommand: recordingRunner(calls) })

      expect(calls).toEqual([])
      expect(await exists(join(root, 'src/VibeCheckDevtools.tsx'))).toBe(false)
      expect(result.projectId).toBe('storefront')
      expect(result.actions.join('\n')).toContain('pnpm add --save-dev @wcgw/vibe-check@0.3.0')
      expect(result.actions.join('\n')).toContain('codex mcp add vibe-check')
      expect(result.nextSteps.join('\n')).toContain('watch_for_issue')
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
        version: '0.3.0',
        dryRun: false,
        force: false,
      }, { runCommand: runner })

      const source = await readFile(join(root, 'src/VibeCheckDevtools.tsx'), 'utf8')
      expect(source).toContain("projectId: '@acme/storefront'")
      expect(calls.map(({ command, args }) => [command, ...args])).toEqual([
        ['pnpm', 'add', '--save-dev', '@wcgw/vibe-check@0.3.0'],
        ['codex', 'mcp', 'get', 'vibe-check', '--json'],
        ['codex', 'mcp', 'add', 'vibe-check', '--', 'npx', '-y', '@wcgw/vibe-check-mcp@0.3.0', 'connect'],
      ])
      expect(result.componentPath).toBe('src/VibeCheckDevtools.tsx')
    })
  })

  it('skips an installed widget and an existing Codex server', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0' },
      devDependencies: { '@wcgw/vibe-check': '^0.3.0' },
    }, async (root) => {
      const calls: CommandCall[] = []

      const result = await runSetup({
        cwd: root,
        agent: 'codex',
        version: '0.3.0',
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
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': '^0.3.0' },
    }, async (root) => {
      await writeFile(join(root, 'VibeCheckDevtools.tsx'), 'keep me')
      const options = {
        cwd: root,
        agent: 'codex' as const,
        version: '0.3.0',
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
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': '^0.3.0' },
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
        version: '0.3.0',
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner([]) })

      const config = JSON.parse(await readFile(join(root, '.cursor/mcp.json'), 'utf8'))
      expect(config.theme).toBe('dark')
      expect(config.mcpServers.existing).toEqual({ command: 'existing-server' })
      expect(config.mcpServers['vibe-check']).toEqual({
        command: 'npx',
        args: ['-y', '@wcgw/vibe-check-mcp@0.3.0', 'connect'],
      })
      await expect(readFile(join(root, 'VibeCheckDevtools.tsx'), 'utf8')).resolves.toContain("projectId: 'storefront-web'")
    })
  })

  it('rejects malformed Cursor JSON instead of replacing it', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': '^0.3.0' },
    }, async (root) => {
      await mkdir(join(root, '.cursor'))
      await writeFile(join(root, '.cursor/mcp.json'), '{ broken')

      await expect(runSetup({
        cwd: root,
        agent: 'cursor',
        version: '0.3.0',
        dryRun: false,
        force: false,
      }, { runCommand: recordingRunner([]) })).rejects.toThrow('valid JSON')
      await expect(readFile(join(root, '.cursor/mcp.json'), 'utf8')).resolves.toBe('{ broken')
    })
  })

  it('uses Claude local scope and the matching MCP version', async () => {
    await withProject({
      name: 'storefront',
      dependencies: { react: '^19.0.0', '@wcgw/vibe-check': '^0.3.0' },
    }, async (root) => {
      const calls: CommandCall[] = []
      const runner = recordingRunner(calls, (_command, args) => args.includes('get') ? 1 : 0)

      await runSetup({
        cwd: root,
        agent: 'claude-code',
        version: '0.3.0',
        dryRun: false,
        force: false,
      }, { runCommand: runner })

      expect(calls.map(({ command, args }) => [command, ...args])).toEqual([
        ['claude', 'mcp', 'get', 'vibe-check'],
        ['claude', 'mcp', 'add', '--scope', 'local', 'vibe-check', '--', 'npx', '-y', '@wcgw/vibe-check-mcp@0.3.0', 'connect'],
      ])
    })
  })
})
