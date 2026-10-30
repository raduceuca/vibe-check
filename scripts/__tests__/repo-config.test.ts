import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import rootVitestConfig from '../../vitest.config.ts'

const root = join(import.meta.dirname, '..', '..')
const read = (path: string): string => readFileSync(join(root, path), 'utf8')

describe('root vitest projects (REL-9)', () => {
  it('lists every package vitest config, so root runs use each package environment', () => {
    const projects = (rootVitestConfig.test?.projects ?? []).filter((project): project is string => typeof project === 'string')
    const packageConfigs = readdirSync(join(root, 'packages'))
      .map((name) => `packages/${name}/vitest.config.ts`)
      .filter((path) => existsSync(join(root, path)))

    expect(packageConfigs.length).toBeGreaterThan(0)
    for (const config of packageConfigs) expect(projects).toContain(config)
    expect(rootVitestConfig.test?.coverage).toMatchObject({ provider: 'v8' })
  })

  it('has no vitest.workspace.ts, which Vitest 4 silently ignores', () => {
    expect(existsSync(join(root, 'vitest.workspace.ts'))).toBe(false)
  })
})

describe('root package scripts (REL-18)', () => {
  const pkg = JSON.parse(read('package.json')) as {
    readonly scripts: Readonly<Record<string, string>>
    readonly engines: Readonly<Record<string, string>>
  }

  it('has no publish path outside the release workflow', () => {
    expect(Object.keys(pkg.scripts).filter((name) => name.startsWith('publish:'))).toEqual([])
    for (const command of Object.values(pkg.scripts)) {
      expect(command).not.toMatch(/\bpnpm -r publish\b/)
    }
  })

  it('points every release script at a script that exists', () => {
    for (const [name, command] of Object.entries(pkg.scripts)) {
      if (!name.startsWith('release:')) continue
      const file = /^node (scripts\/\S+\.mjs)$/.exec(command)?.[1]
      expect(file, name).toBeDefined()
      expect(existsSync(join(root, file ?? '')), name).toBe(true)
    }
  })

  it('declares the Node range CI tests (REL-10)', () => {
    expect(pkg.engines.node).toBe('>=22.12.0')
  })
})

describe('local agent tooling is ignored (REL-11)', () => {
  const ignored = (path: string): boolean => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--no-index', path], { cwd: root })
      return true
    } catch {
      return false
    }
  }

  it('ignores per-machine agent directories and linked third-party skills', () => {
    for (const path of ['.agents/skills/x/SKILL.md', '.claude/settings.json', '.codex/config.toml', '.impeccable/config.json',
      'packages/react/.impeccable/surfaces/a.md', 'skills-lock.json', 'skills/autofix', 'skills/code-review']) {
      expect(ignored(path), path).toBe(true)
    }
  })

  it('keeps the product brief, taste briefs and the shipped skill visible to git', () => {
    for (const path of ['PRODUCT.md', 'tastefiles/widget.md', 'skills/vibe-check/SKILL.md', 'README.md']) {
      expect(ignored(path), path).toBe(false)
    }
  })
})
