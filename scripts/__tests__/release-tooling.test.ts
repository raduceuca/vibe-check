import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import {
  formatSmokeResults,
  runProductionSmoke,
} from '../production-smoke.mjs'
import {
  parseReleaseVersionArgs,
  readReleaseManifest,
  validateReleaseVersion,
} from '../release-manifest.mjs'
import {
  publishMissingPackages,
  publishPackage,
  registryHasPackage,
} from '../publish-release.mjs'

describe('release tooling test harness', () => {
  it('runs tooling tests in a Node environment', () => {
    expect(typeof process.versions.node).toBe('string')
  })
})

const ORIGIN = 'https://vibecheck.wcgw.fun'

const passingBody = (pathname: string): string => {
  if (pathname === '/') return `<html><head><title>VibeCheck</title><link rel="canonical" href="${ORIGIN}"></head></html>`
  if (pathname === '/docs/quickstart') return '<html><title>Quickstart</title>@wcgw/vibe-check-mcp</html>'
  if (pathname === '/robots.txt') return `User-agent: *\nSitemap: ${ORIGIN}/sitemap.xml\n`
  if (pathname === '/sitemap.xml') return `<?xml version="1.0"?><urlset><url><loc>${ORIGIN}/</loc></url></urlset>`
  if (pathname === '/llms.txt') return '# VibeCheck\nBrowser performance monitoring for AI-assisted coding.'
  return 'x'.repeat(2_048)
}

const passingType = (pathname: string): string => {
  if (pathname === '/opengraph-image') return 'image/png'
  if (pathname === '/sitemap.xml') return 'application/xml'
  if (pathname === '/robots.txt' || pathname === '/llms.txt') return 'text/plain; charset=utf-8'
  return 'text/html; charset=utf-8'
}

const passingFetch = async (input: string | URL | Request): Promise<Response> => {
  const pathname = new URL(String(input)).pathname
  return new Response(passingBody(pathname), {
    status: 200,
    headers: { 'content-type': passingType(pathname) },
  })
}

describe('production smoke checks', () => {
  it('validates every public production route', async () => {
    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl: passingFetch,
      retries: 1,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(results).toHaveLength(6)
    expect(results.every((result) => result.ok)).toBe(true)
    expect(results.map((result) => result.path)).toEqual([
      '/',
      '/docs/quickstart',
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
      '/opengraph-image',
    ])
  })

  it('retries a transient edge failure and reports the attempt count', async () => {
    let homeAttempts = 0
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/' && homeAttempts++ === 0) return new Response('temporary', { status: 500 })
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 2,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(results.find((result) => result.path === '/')).toMatchObject({ ok: true, attempts: 2 })
  })

  it('bounds every production route request with an abort signal', async () => {
    const signals: AbortSignal[] = []
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      signals.push(init?.signal as AbortSignal)
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 1,
      requestTimeoutMs: 25,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(results.every((result) => result.ok)).toBe(true)
    expect(signals).toHaveLength(6)
    expect(signals.every((signal) => signal instanceof AbortSignal)).toBe(true)
  })

  it('fails a persistent content-type mismatch with an actionable reason', async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/opengraph-image') {
        return new Response('not an image', { status: 200, headers: { 'content-type': 'text/plain' } })
      }
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 2,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })
    const image = results.find((result) => result.path === '/opengraph-image')

    expect(image).toMatchObject({ ok: false, attempts: 2, status: 200 })
    expect(image?.reason).toContain('image/png')
    expect(formatSmokeResults(results)).toContain('FAIL /opengraph-image')
  })

  it('names the missing route assertion in formatted output', async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/robots.txt') {
        return new Response('User-agent: *', { status: 200, headers: { 'content-type': 'text/plain' } })
      }
      return passingFetch(input)
    }

    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl,
      retries: 1,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(formatSmokeResults(results)).toContain(`FAIL /robots.txt`)
    expect(formatSmokeResults(results)).toContain(`${ORIGIN}/sitemap.xml`)
  })
})

const releasePackagePaths = [
  ['packages/core', '@wcgw/vibe-check-core'],
  ['packages/mcp', '@wcgw/vibe-check-mcp'],
  ['packages/react', '@wcgw/vibe-check'],
] as const

const withReleaseFixture = async (
  versions: Readonly<Record<string, string>>,
  run: (root: string) => Promise<void>,
): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'vibe-check-release-manifest-'))
  try {
    for (const [directory, name] of releasePackagePaths) {
      await mkdir(join(root, directory), { recursive: true })
      await writeFile(join(root, directory, 'package.json'), JSON.stringify({
        name,
        version: versions[name] ?? '0.3.0',
      }))
    }
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

describe('release manifest', () => {
  it('accepts pnpm argument forwarding with or without a separator', () => {
    expect(parseReleaseVersionArgs(['--', '0.3.0'])).toBe('0.3.0')
    expect(parseReleaseVersionArgs(['0.3.0'])).toBe('0.3.0')
    expect(() => parseReleaseVersionArgs(['--'])).toThrow('Usage')
  })

  it('reads public packages in dependency-safe publish order', async () => {
    await withReleaseFixture({}, async (root) => {
      const manifest = await readReleaseManifest(root)

      expect(manifest).toEqual([
        { name: '@wcgw/vibe-check-core', directory: 'packages/core', version: '0.3.0' },
        { name: '@wcgw/vibe-check-mcp', directory: 'packages/mcp', version: '0.3.0' },
        { name: '@wcgw/vibe-check', directory: 'packages/react', version: '0.3.0' },
      ])
    })
  })

  it('reports every package whose version differs from the requested release', async () => {
    await withReleaseFixture({
      '@wcgw/vibe-check-core': '0.3.0',
      '@wcgw/vibe-check-mcp': '0.2.1',
      '@wcgw/vibe-check': '0.2.0',
    }, async (root) => {
      const manifest = await readReleaseManifest(root)

      expect(() => validateReleaseVersion(manifest, '0.3.0')).toThrow(
        '@wcgw/vibe-check-mcp=0.2.1, @wcgw/vibe-check=0.2.0',
      )
    })
  })

  it('rejects a non-semver release input', async () => {
    await withReleaseFixture({}, async (root) => {
      const manifest = await readReleaseManifest(root)

      expect(() => validateReleaseVersion(manifest, 'next')).toThrow('valid semantic version')
    })
  })
})

describe('resumable package publishing', () => {
  const packages = releasePackagePaths.map(([directory, name]) => ({ name, directory, version: '0.3.0' }))

  it('skips published versions and publishes each missing package in order', async () => {
    const published: string[] = []
    const messages: string[] = []

    const results = await publishMissingPackages({
      packages,
      packageExists: async (pkg) => pkg.name === '@wcgw/vibe-check-core',
      publishPackage: async (pkg) => { published.push(pkg.name) },
      log: (message) => { messages.push(message) },
    })

    expect(results).toEqual([
      { name: '@wcgw/vibe-check-core', version: '0.3.0', action: 'skipped' },
      { name: '@wcgw/vibe-check-mcp', version: '0.3.0', action: 'published' },
      { name: '@wcgw/vibe-check', version: '0.3.0', action: 'published' },
    ])
    expect(published).toEqual(['@wcgw/vibe-check-mcp', '@wcgw/vibe-check'])
    expect(messages.join('\n')).toContain('already exists; skipping')
  })

  it('stops before later packages when a publish fails', async () => {
    const attempted: string[] = []

    await expect(publishMissingPackages({
      packages,
      packageExists: async () => false,
      publishPackage: async (pkg) => {
        attempted.push(pkg.name)
        if (pkg.name === '@wcgw/vibe-check-mcp') throw new Error('registry unavailable')
      },
      log: () => undefined,
    })).rejects.toThrow('registry unavailable')

    expect(attempted).toEqual(['@wcgw/vibe-check-core', '@wcgw/vibe-check-mcp'])
  })

  it('bounds npm registry requests', async () => {
    let signal: AbortSignal | undefined
    const exists = await registryHasPackage(packages[0], {
      timeoutMs: 25,
      fetchImpl: async (_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal
        return new Response('{}', { status: 200 })
      },
    })

    expect(exists).toBe(true)
    expect(signal).toBeInstanceOf(AbortSignal)
  })

  it('bounds publish execution and preserves command failure output', async () => {
    let timeout = 0
    const errors: string[] = []
    const failure = Object.assign(new Error('publish failed'), {
      stdout: 'npm stdout',
      stderr: 'npm stderr',
    })

    await expect(publishPackage(packages[0], {
      timeoutMs: 50,
      execFileImpl: async (_command: string, _args: readonly string[], options: { timeout?: number }) => {
        timeout = options.timeout ?? 0
        throw failure
      },
      writeError: (message: string) => { errors.push(message) },
    })).rejects.toBe(failure)

    expect(timeout).toBe(50)
    expect(errors.join('\n')).toContain('npm stdout')
    expect(errors.join('\n')).toContain('npm stderr')
  })
})

describe('GitHub release and monitoring workflows', () => {
  it('guards production release with OIDC, environment, and concurrency', async () => {
    const source = await readFile(join(process.cwd(), '.github/workflows/release.yml'), 'utf8')
    const workflow = parse(source)

    expect(workflow.on.workflow_dispatch.inputs.version.required).toBe(true)
    expect(workflow.permissions).toMatchObject({ contents: 'write', 'id-token': 'write' })
    expect(workflow.concurrency).toMatchObject({
      group: 'vibe-check-production-release',
      'cancel-in-progress': false,
    })
    expect(workflow.jobs.release.environment.name).toBe('production')
    expect(workflow.jobs.release.steps[1].with).toMatchObject({
      'fetch-depth': 0,
      'persist-credentials': false,
    })
    const steps = workflow.jobs.release.steps as Array<{ name?: string; run?: string }>
    const buildLibrariesIndex = steps.findIndex((step) => step.name === 'Build workspace libraries for app type-checks')
    const typeCheckIndex = steps.findIndex((step) => step.name === 'Type-check packages and apps')

    expect(buildLibrariesIndex).toBeGreaterThan(-1)
    expect(typeCheckIndex).toBeGreaterThan(buildLibrariesIndex)
    expect(steps[buildLibrariesIndex]?.run).toBe(
      'pnpm --filter @wcgw/vibe-check-protocol --filter @wcgw/vibe-check-core --filter @wcgw/vibe-check build',
    )
    expect(source).not.toContain('NPM_TOKEN')
    expect(source).toContain('npm@11.5.1')
    expect(source).not.toContain('npm@^11.5.1')
    expect(source).toContain('pnpm release:publish')
    expect(source).toContain('pnpm --filter web cf:deploy')
    expect(source).toContain('repos/$GITHUB_REPOSITORY/git/refs')
    expect(source).not.toContain('git push origin "$tag"')
  })

  it('runs the production monitor on schedule and on demand', async () => {
    const source = await readFile(join(process.cwd(), '.github/workflows/production-smoke.yml'), 'utf8')
    const workflow = parse(source)

    expect(workflow.on.schedule).toEqual([{ cron: '17,47 * * * *' }])
    expect(workflow.on.workflow_dispatch.inputs.origin.default).toBe(ORIGIN)
    expect(workflow.jobs.smoke['timeout-minutes']).toBe(10)
    expect(workflow.jobs.smoke.steps[0].with).toMatchObject({ 'persist-credentials': false })
  })
})
