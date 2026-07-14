import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const here = dirname(new URL(import.meta.url).pathname)
const repoRoot = resolve(here, '../../..')
const fixtureSource = resolve(here, '../fixtures')

const run = async (command: string, args: readonly string[], cwd: string): Promise<string> => {
  try {
    const { stdout } = await execFileAsync(command, [...args], { cwd })
    return stdout
  } catch (error) {
    const failure = error as Error & { readonly stdout?: string; readonly stderr?: string }
    throw new Error(`${failure.message}\nstdout:\n${failure.stdout ?? ''}\nstderr:\n${failure.stderr ?? ''}`)
  }
}

export interface InstalledFixture {
  readonly root: string
  readonly appA: string
  readonly appB: string
  readonly hubBin: string
  readonly registryPath: string
  cleanup(): Promise<void>
}

const pack = async (packageDir: string, destination: string): Promise<string> => {
  const stdout = await run('pnpm', ['pack', '--pack-destination', destination], join(repoRoot, packageDir))
  return join(destination, basename(stdout.trim()))
}

export const installFixture = async (): Promise<InstalledFixture> => {
  const root = await mkdtemp(join(tmpdir(), 'vibe-check-e2e-'))
  try {
    const tarballs = join(root, 'tarballs')
    await run('mkdir', ['-p', tarballs], repoRoot)
    await run('pnpm', ['--filter', '@wcgw/vibe-check-core', '--filter', '@wcgw/vibe-check', '--filter', '@wcgw/vibe-check-mcp', 'build'], repoRoot)
    const core = await pack('packages/core', tarballs)
    const react = await pack('packages/react', tarballs)
    const mcp = await pack('packages/mcp', tarballs)

    const installApp = async (name: string): Promise<string> => {
      const app = join(root, name)
      await cp(fixtureSource, app, { recursive: true })
      await writeFile(join(app, 'package.json'), JSON.stringify({
        name: `vibe-check-${name}`,
        private: true,
        type: 'module',
        dependencies: {
          '@wcgw/vibe-check-core': `file:${core}`,
          '@wcgw/vibe-check': `file:${react}`,
          '@wcgw/vibe-check-mcp': `file:${mcp}`,
          '@vitejs/plugin-react': '^6.0.1',
          react: '^19.2.4',
          'react-dom': '^19.2.4',
          vite: '^8.0.1',
        },
        pnpm: {
          overrides: {
            '@wcgw/vibe-check-core': `file:${core}`,
          },
        },
      }, null, 2))
      await run('pnpm', ['install', '--ignore-workspace', '--frozen-lockfile=false'], app)
      return app
    }

    const appA = await installApp('app-a')
    const appB = await installApp('app-b')
    const packageJson = JSON.parse(await readFile(join(appA, 'node_modules/@wcgw/vibe-check-mcp/package.json'), 'utf8')) as { bin: { 'vibe-check-mcp': string } }
    const hubBin = join(appA, 'node_modules/@wcgw/vibe-check-mcp', packageJson.bin['vibe-check-mcp'])
    return {
      root,
      appA,
      appB,
      hubBin,
      registryPath: join(root, 'projects.json'),
      cleanup: () => rm(root, { recursive: true, force: true }),
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}
