import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  checkReleaseReadiness,
  findStaleVersionPins,
  findVersionPins,
  listPinnedDocuments,
  readChangelogSection,
} from '../release-manifest.mjs'
import { releaseNotesFor } from '../release-notes.mjs'

const PACKAGES = [
  ['packages/core', '@wcgw/vibe-check-core'],
  ['packages/mcp', '@wcgw/vibe-check-mcp'],
  ['packages/react', '@wcgw/vibe-check'],
] as const

const CHANGELOG = [
  '# Changelog',
  '',
  '## 0.4.0',
  '',
  '### New',
  '',
  '- Guided `up` command.',
  '',
  '## 0.3.0',
  '',
  '- Older notes.',
  '',
].join('\n')

const withRepo = async (
  files: Readonly<Record<string, string>>,
  run: (root: string) => Promise<void>,
): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'vibe-check-readiness-'))
  try {
    for (const [directory, name] of PACKAGES) {
      await mkdir(join(root, directory), { recursive: true })
      await writeFile(join(root, directory, 'package.json'), JSON.stringify({ name, version: '0.4.0' }))
    }
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), content)
    }
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('version pins in docs (REL-2)', () => {
  it('finds every copyable package pin with its line', () => {
    const text = [
      'npx -y @wcgw/vibe-check-mcp@0.4.0 up',
      'npm install @wcgw/vibe-check@0.3.0 @wcgw/vibe-check-core@0.5.0-rc.1.',
      'npx -y @wcgw/vibe-check-mcp@latest setup',
      'workspace: @wcgw/vibe-check-protocol@0.4.0',
    ].join('\n')

    expect(findVersionPins(text)).toEqual([
      { line: 1, spec: '@wcgw/vibe-check-mcp@0.4.0', name: '@wcgw/vibe-check-mcp', version: '0.4.0' },
      { line: 2, spec: '@wcgw/vibe-check@0.3.0', name: '@wcgw/vibe-check', version: '0.3.0' },
      { line: 2, spec: '@wcgw/vibe-check-core@0.5.0-rc.1', name: '@wcgw/vibe-check-core', version: '0.5.0-rc.1' },
    ])
  })

  it('scans the README, package READMEs, skills, demo and launch copy but not historical records', async () => {
    await withRepo({
      'README.md': 'npx -y @wcgw/vibe-check-mcp@0.3.0 hub\n',
      'packages/mcp/README.md': 'npx -y @wcgw/vibe-check-mcp@0.4.0 hub\n',
      'skills/vibe-check/SKILL.md': 'x\nnpx -y @wcgw/vibe-check-mcp@0.3.0 doctor\n',
      'skills/vibe-check/notes.md': 'npx -y @wcgw/vibe-check-mcp@0.3.0 hub\n',
      'demo/src/App.tsx': '// npx -y @wcgw/vibe-check-mcp@0.3.0 hub\n',
      'demo/node_modules/x/README.md': '@wcgw/vibe-check-mcp@0.1.0\n',
      'demo/dist/index.js': '@wcgw/vibe-check-mcp@0.1.0\n',
      'docs/launch/show-hn.md': 'npx -y @wcgw/vibe-check-mcp@0.3.0 up\n',
      'docs/superpowers/plans/old.md': 'npx -y @wcgw/vibe-check-mcp@0.2.0 hub\n',
      'apps/web/content/docs/quickstart.mdx': 'npx -y @wcgw/vibe-check-mcp@0.3.0 hub\n',
    }, async (root) => {
      const { stale } = await findStaleVersionPins(root, '0.4.0')

      expect(stale).toEqual([
        { path: 'README.md', line: 1, spec: '@wcgw/vibe-check-mcp@0.3.0' },
        { path: 'demo/src/App.tsx', line: 1, spec: '@wcgw/vibe-check-mcp@0.3.0' },
        { path: 'docs/launch/show-hn.md', line: 1, spec: '@wcgw/vibe-check-mcp@0.3.0' },
        { path: 'skills/vibe-check/SKILL.md', line: 2, spec: '@wcgw/vibe-check-mcp@0.3.0' },
      ])
    })
  })

  it('does not follow symlinked third-party skills', async () => {
    await withRepo({
      'skills/vibe-check/SKILL.md': 'ok\n',
      'vendor/other/SKILL.md': 'npx -y @wcgw/vibe-check-mcp@0.1.0 hub\n',
    }, async (root) => {
      await symlink(join(root, 'vendor/other'), join(root, 'skills/other'))

      expect(await listPinnedDocuments(root)).toEqual(['skills/vibe-check/SKILL.md'])
    })
  })
})

describe('CHANGELOG section (P8)', () => {
  it('returns the body of the requested version only', () => {
    expect(readChangelogSection(CHANGELOG, '0.4.0')).toBe('### New\n\n- Guided `up` command.')
    expect(readChangelogSection(CHANGELOG, '0.3.0')).toBe('- Older notes.')
  })

  it('treats a missing or empty section as absent', () => {
    expect(readChangelogSection(CHANGELOG, '0.5.0')).toBeNull()
    expect(readChangelogSection('## 0.4.0\n\n## 0.3.0\n- x\n', '0.4.0')).toBeNull()
    expect(readChangelogSection('## 0.4.0-rc.1\n- rc\n', '0.4.0')).toBeNull()
  })

  it('accepts bracketed and v-prefixed headings', () => {
    expect(readChangelogSection('## [0.4.0] - 2026-10-30\n- a\n', '0.4.0')).toBe('- a')
    expect(readChangelogSection('## v0.4.0\n- b\n', '0.4.0')).toBe('- b')
  })

  it('prints the section as GitHub release notes and refuses a missing one', async () => {
    await withRepo({ 'CHANGELOG.md': CHANGELOG }, async (root) => {
      expect(await releaseNotesFor('0.4.0', root)).toBe('### New\n\n- Guided `up` command.\n')
      await expect(releaseNotesFor('0.9.0', root)).rejects.toThrow('no "## 0.9.0" section')
    })
  })
})

describe('release readiness', () => {
  it('passes when versions, pins, CHANGELOG and the generated version agree', async () => {
    await withRepo({
      'README.md': 'npx -y @wcgw/vibe-check-mcp@0.4.0 hub\n',
      'CHANGELOG.md': CHANGELOG,
    }, async (root) => {
      const result = await checkReleaseReadiness({ root, version: '0.4.0', checkGenerated: async () => null })

      expect(result.problems).toEqual([])
      expect(result.manifest.map((pkg: { name: string }) => pkg.name)).toEqual(PACKAGES.map(([, name]) => name))
    })
  })

  it('reports every problem at once instead of stopping at the first', async () => {
    await withRepo({
      'README.md': 'npx -y @wcgw/vibe-check-mcp@0.3.0 hub\n',
      'CHANGELOG.md': '# Changelog\n\n## 0.3.0\n- old\n',
    }, async (root) => {
      const { problems } = await checkReleaseReadiness({
        root,
        version: '0.4.0',
        checkGenerated: async () => 'src/version.generated.ts is stale',
      })

      expect(problems).toEqual([
        'README.md:1 pins @wcgw/vibe-check-mcp@0.3.0; expected @0.4.0',
        'CHANGELOG.md has no "## 0.4.0" section with release notes',
        'src/version.generated.ts is stale',
      ])
    })
  })

  it('reports a package version mismatch alongside doc problems', async () => {
    await withRepo({ 'CHANGELOG.md': CHANGELOG }, async (root) => {
      const { problems } = await checkReleaseReadiness({ root, version: '0.4.1', checkGenerated: async () => null })

      expect(problems[0]).toContain('does not match')
      expect(problems[1]).toContain('no "## 0.4.1" section')
    })
  })
})
