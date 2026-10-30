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
  if (pathname === '/llms-full.txt') return '# VibeCheck\n\n# Documentation\n\n# Quickstart\n'
  if (pathname === '/md/docs/quickstart') return '# Quickstart\n\nnpx -y @wcgw/vibe-check-mcp@0.4.0 up\n'
  if (pathname === '/scan') return '<html><head><title>Scan your site · VibeCheck</title></head></html>'
  if (pathname === '/fix/performance') return '<html><head><title>Performance — fix guides</title></head></html>'
  if (pathname === '/api/scan') return JSON.stringify({ error: 'That URL points to a private address.' })
  return 'x'.repeat(2_048)
}

const passingType = (pathname: string): string => {
  if (pathname === '/opengraph-image') return 'image/png'
  if (pathname === '/sitemap.xml') return 'application/xml'
  if (pathname === '/md/docs/quickstart') return 'text/markdown; charset=utf-8'
  if (pathname === '/api/scan') return 'application/json'
  if (pathname === '/robots.txt' || pathname === '/llms.txt' || pathname === '/llms-full.txt') return 'text/plain; charset=utf-8'
  return 'text/html; charset=utf-8'
}

const passingFetch = async (input: string | URL | Request): Promise<Response> => {
  const pathname = new URL(String(input)).pathname
  return new Response(passingBody(pathname), {
    status: pathname === '/api/scan' ? 400 : 200,
    headers: { 'content-type': passingType(pathname) },
  })
}

const SMOKE_ROUTES = [
  '/',
  '/docs/quickstart',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
  '/opengraph-image',
  '/llms-full.txt',
  '/md/docs/quickstart',
  '/scan',
  '/fix/performance',
  'POST /api/scan',
]

describe('production smoke checks', () => {
  it('validates every public production route', async () => {
    const results = await runProductionSmoke({
      origin: ORIGIN,
      fetchImpl: passingFetch,
      retries: 1,
      retryDelayMs: 0,
      sleep: async () => undefined,
    })

    expect(results).toHaveLength(SMOKE_ROUTES.length)
    expect(results.every((result) => result.ok)).toBe(true)
    expect(results.map((result) => result.path)).toEqual(SMOKE_ROUTES)
  })

  it('exercises the dynamic scan route with a refused POST and no scan', async () => {
    const requests: Array<{ path: string; method: string; body: string | null }> = []
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      requests.push({
        path: new URL(String(input)).pathname,
        method: init?.method ?? 'GET',
        body: typeof init?.body === 'string' ? init.body : null,
      })
      return passingFetch(input)
    }

    await runProductionSmoke({ origin: ORIGIN, fetchImpl, retries: 1, retryDelayMs: 0, sleep: async () => undefined })
    const scan = requests.find((request) => request.path === '/api/scan')

    expect(scan?.method).toBe('POST')
    expect(JSON.parse(scan?.body ?? '{}')).toEqual({ url: 'http://127.0.0.1/' })
    expect(requests.filter((request) => request.path !== '/api/scan').every((request) => request.method === 'GET')).toBe(true)
  })

  it('fails the scan check when the dynamic route errors instead of refusing', async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/api/scan') {
        return new Response('<html>Internal error</html>', { status: 500, headers: { 'content-type': 'text/html' } })
      }
      return passingFetch(input)
    }

    const results = await runProductionSmoke({ origin: ORIGIN, fetchImpl, retries: 1, retryDelayMs: 0, sleep: async () => undefined })

    expect(results.find((result) => result.path === 'POST /api/scan')).toMatchObject({
      ok: false,
      status: 500,
      reason: 'expected HTTP 400, received 500',
    })
  })

  it('fails the markdown route when it serves HTML instead of markdown', async () => {
    const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
      const pathname = new URL(String(input)).pathname
      if (pathname === '/md/docs/quickstart') {
        return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } })
      }
      return passingFetch(input)
    }

    const results = await runProductionSmoke({ origin: ORIGIN, fetchImpl, retries: 1, retryDelayMs: 0, sleep: async () => undefined })

    expect(results.find((result) => result.path === '/md/docs/quickstart')?.reason).toContain('text/markdown')
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
    expect(signals).toHaveLength(SMOKE_ROUTES.length)
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

  type Step = { name?: string; run?: string; uses?: string; env?: Record<string, string>; with?: Record<string, unknown> }

  const releaseSteps = async (): Promise<Step[]> => {
    const workflow = parse(await readFile(join(process.cwd(), '.github/workflows/release.yml'), 'utf8'))
    return workflow.jobs.release.steps as Step[]
  }

  const indexOfRun = (steps: readonly Step[], fragment: string): number =>
    steps.findIndex((step) => step.run?.includes(fragment) === true)

  it('checks the deploy credentials before installing, building, or publishing (REL-3)', async () => {
    const steps = await releaseSteps()
    const preflight = indexOfRun(steps, 'scripts/release-preflight.mjs')

    expect(preflight).toBeGreaterThan(-1)
    expect(preflight).toBeLessThan(indexOfRun(steps, 'pnpm install --frozen-lockfile'))
    expect(preflight).toBeLessThan(indexOfRun(steps, 'pnpm release:publish'))
    expect(steps[preflight]?.env).toMatchObject({
      CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
      CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
      NEXT_PUBLIC_SCAN_API: '${{ vars.NEXT_PUBLIC_SCAN_API }}',
    })
  })

  it('validates doc pins and the CHANGELOG before publishing (REL-2)', async () => {
    const steps = await releaseSteps()

    expect(indexOfRun(steps, 'pnpm release:validate -- "$VERSION"')).toBeLessThan(indexOfRun(steps, 'pnpm release:publish'))
  })

  it('asserts packed tarball contents instead of a publish dry run (REL-6)', async () => {
    const steps = await releaseSteps()
    const ci = await readFile(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8')
    const check = indexOfRun(steps, 'pnpm release:check-packages -- "$VERSION"')

    expect(check).toBeGreaterThan(indexOfRun(steps, 'pnpm build'))
    expect(check).toBeLessThan(indexOfRun(steps, 'pnpm release:publish'))
    expect(ci).toContain('pnpm release:check-packages')
    expect(steps.some((step) => step.run?.includes('publish:dry') === true)).toBe(false)
    expect(ci).not.toContain('publish:dry')
  })

  it('passes the scan API setting explicitly to the site build (REL-15)', async () => {
    const steps = await releaseSteps()
    const deploy = steps.find((step) => step.run === 'pnpm --filter web cf:deploy')

    expect(deploy?.env).toMatchObject({ NEXT_PUBLIC_SCAN_API: '${{ vars.NEXT_PUBLIC_SCAN_API }}' })
  })

  it('takes release notes from the CHANGELOG and keeps prereleases off latest (REL-7, REL-16)', async () => {
    const steps = await releaseSteps()
    const release = steps.find((step) => step.name === 'Create tag and GitHub release')?.run ?? ''

    expect(release).toContain('node scripts/release-notes.mjs "$VERSION"')
    expect(release).toContain('--notes-file "$notes"')
    expect(release).not.toContain('--generate-notes')
    expect(release).toContain('release_flag=--prerelease')
    expect(release).toContain('release_flag=--latest')
  })

  it('pins every action to a full commit SHA (REL-13)', async () => {
    for (const file of ['ci.yml', 'release.yml', 'production-smoke.yml']) {
      const source = await readFile(join(process.cwd(), '.github/workflows', file), 'utf8')
      const uses = [...source.matchAll(/uses:\s*(\S+)/g)].map((match) => match[1])

      expect(uses.length).toBeGreaterThan(0)
      for (const action of uses) expect(action, `${file}: ${action}`).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/)
    }
  })

  it('tests the Node version that releases run on (REL-10)', async () => {
    const steps = await releaseSteps()
    const releaseNode = String(steps.find((step) => step.uses?.startsWith('actions/setup-node@'))?.with?.['node-version'])
    const ci = parse(await readFile(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8'))
    const smoke = parse(await readFile(join(process.cwd(), '.github/workflows/production-smoke.yml'), 'utf8'))
    const smokeNode = String((smoke.jobs.smoke.steps as Step[]).find((step) => step.uses?.startsWith('actions/setup-node@'))?.with?.['node-version'])
    const nvmrc = (await readFile(join(process.cwd(), '.nvmrc'), 'utf8')).trim()

    expect(ci.jobs.verify.strategy.matrix.node.map(String)).toContain(releaseNode)
    expect(nvmrc).toBe(releaseNode)
    expect(smokeNode).toBe(releaseNode)
  })
})
