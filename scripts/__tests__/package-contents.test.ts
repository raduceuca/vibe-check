import { describe, expect, it } from 'vitest'
import { inspectPackedPackage } from '../check-package-contents.mjs'

type Manifest = Record<string, unknown>

const reactManifest = (overrides: Manifest = {}): Manifest => ({
  name: '@wcgw/vibe-check',
  version: '0.4.0',
  main: './dist/index.cjs',
  module: './dist/index.js',
  types: './dist/index.d.ts',
  exports: {
    '.': {
      import: { types: './dist/index.d.ts', default: './dist/index.js' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    },
  },
  dependencies: { '@wcgw/vibe-check-core': '^0.4.0', liveline: '^0.0.7' },
  peerDependencies: { react: '>=18.0.0' },
  ...overrides,
})

const REACT_FILES = [
  'LICENSE',
  'README.md',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.cts',
  'dist/index.d.ts',
  'dist/index.js',
  'dist/index.js.map',
  'package.json',
]

const inspect = async ({
  name = '@wcgw/vibe-check',
  files = REACT_FILES,
  manifest = reactManifest(),
  contents = {},
}: {
  name?: string
  files?: readonly string[]
  manifest?: Manifest
  contents?: Readonly<Record<string, string>>
} = {}): Promise<string[]> => inspectPackedPackage({
  name,
  version: '0.4.0',
  files,
  manifest,
  readText: async (file: string) => contents[file] ?? (file === 'README.md'
    ? '# Widget\n\n![Monitor](https://raw.githubusercontent.com/raduceuca/vibe-check/main/docs/x.png)\n'
    : "import { x } from '@wcgw/vibe-check-core'\n//# sourceMappingURL=index.js.map\n"),
})

describe('packed tarball contents (REL-6)', () => {
  it('accepts a correctly built and packed package', async () => {
    expect(await inspect()).toEqual([])
  })

  it('rejects source, tests and stray files', async () => {
    const problems = await inspect({
      files: [...REACT_FILES, 'src/index.ts', 'dist/__tests__/a.test.js', 'tsconfig.json'],
    })

    expect(problems).toContain('unexpected file src/index.ts')
    expect(problems).toContain('unexpected file tsconfig.json')
    expect(problems).toContain('test file shipped: dist/__tests__/a.test.js')
  })

  it('requires dist output, a README and a LICENSE', async () => {
    const problems = await inspect({ files: ['package.json'] })

    expect(problems).toEqual(expect.arrayContaining([
      'missing README.md',
      'missing LICENSE',
      'no files under dist/ (was the package built?)',
    ]))
  })

  it('rejects unrewritten workspace ranges and a dependency on the private protocol package', async () => {
    const problems = await inspect({
      manifest: reactManifest({
        dependencies: { '@wcgw/vibe-check-core': 'workspace:^', '@wcgw/vibe-check-protocol': '0.4.0' },
        devDependencies: { '@wcgw/vibe-check-protocol': 'workspace:*' },
      }),
    })

    expect(problems).toEqual(expect.arrayContaining([
      'dependencies.@wcgw/vibe-check-core still uses workspace:^',
      'devDependencies.@wcgw/vibe-check-protocol still uses workspace:*',
      'dependencies lists the private package @wcgw/vibe-check-protocol; it must be bundled',
    ]))
  })

  it('requires sibling packages at the release version', async () => {
    const problems = await inspect({
      manifest: reactManifest({ dependencies: { '@wcgw/vibe-check-core': '^0.3.0' } }),
    })

    expect(problems).toEqual(['dependencies.@wcgw/vibe-check-core is ^0.3.0; expected the release version 0.4.0'])
  })

  it('rejects a wrong name or version', async () => {
    const problems = await inspect({ manifest: reactManifest({ version: '0.3.0' }) })

    expect(problems).toContain('package.json version is 0.3.0, expected 0.4.0')
  })

  it('requires every entry point and bin to exist, and bins to have a shebang', async () => {
    const problems = await inspect({
      name: '@wcgw/vibe-check-mcp',
      manifest: {
        name: '@wcgw/vibe-check-mcp',
        version: '0.4.0',
        main: './dist/lib.cjs',
        exports: { '.': { import: './dist/lib.js' } },
        bin: { 'vibe-check-mcp': './dist/index.js' },
      },
      files: ['LICENSE', 'README.md', 'package.json', 'dist/index.js', 'dist/lib.js'],
      contents: { 'dist/index.js': 'console.log(1)\n', 'dist/lib.js': 'export {}\n' },
    })

    expect(problems).toEqual(expect.arrayContaining([
      'entry point dist/lib.cjs is not in the tarball',
      'bin dist/index.js has no shebang',
    ]))
  })

  it('rejects dist code or types that import the private protocol package', async () => {
    const problems = await inspect({
      contents: {
        'dist/index.js': "import { MCP_PACKAGE_SPEC } from '@wcgw/vibe-check-protocol'\n",
        'dist/index.d.ts': "export type { VibeIssue } from \"@wcgw/vibe-check-protocol\";\n",
      },
    })

    expect(problems).toEqual(expect.arrayContaining([
      'dist/index.js imports a private workspace package',
      'dist/index.d.ts imports a private workspace package',
    ]))
  })

  it('ignores protocol paths that only appear in source maps', async () => {
    expect(await inspect({
      contents: { 'dist/index.js.map': '{"sources":["../../protocol/src/index.ts","@wcgw/vibe-check-protocol"]}' },
    })).toEqual([])
  })

  it('rejects more than one sourceMappingURL comment per file (P13)', async () => {
    const problems = await inspect({
      contents: { 'dist/index.js': 'export {}\n//# sourceMappingURL=index.js.map\n//# sourceMappingURL=index.js.map\n' },
    })

    expect(problems).toEqual(['dist/index.js has 2 sourceMappingURL comments; expected at most 1'])
  })

  it('keeps core free of runtime dependencies', async () => {
    const problems = await inspect({
      name: '@wcgw/vibe-check-core',
      manifest: reactManifest({ name: '@wcgw/vibe-check-core', dependencies: { zod: '^3.25.0' } }),
    })

    expect(problems).toContain('core must have zero runtime dependencies; found zod')
  })

  it('rejects README images that npm cannot render, but not commented-out ones', async () => {
    const problems = await inspect({
      contents: {
        'README.md': [
          '![Hero](../../docs/screenshots/hero.png)',
          '<img src="./docs/agent.png" alt="Agent" />',
          '<!-- ![Old](../../docs/screenshots/old.png) -->',
          '![Ok](https://example.com/ok.png)',
        ].join('\n'),
      },
    })

    expect(problems).toEqual([
      'README.md image ../../docs/screenshots/hero.png is a relative path; npm cannot render it',
      'README.md image ./docs/agent.png is a relative path; npm cannot render it',
    ])
  })
})
