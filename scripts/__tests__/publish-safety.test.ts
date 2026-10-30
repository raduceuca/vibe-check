import { describe, expect, it } from 'vitest'
import {
  createCommitVerifier,
  distTagFor,
  publishMissingPackages,
  publishPackage,
  readPublishedCommit,
} from '../publish-release.mjs'

const packages = [
  { name: '@wcgw/vibe-check-core', directory: 'packages/core', version: '0.4.0' },
  { name: '@wcgw/vibe-check-mcp', directory: 'packages/mcp', version: '0.4.0' },
  { name: '@wcgw/vibe-check', directory: 'packages/react', version: '0.4.0' },
]

const COMMIT = 'fbf9d3e217667400b4207c5cd0bca259325d9f52'

// Same shape as https://registry.npmjs.org/-/npm/v1/attestations/@wcgw%2fvibe-check-core@0.3.0
const attestationsBody = (gitCommit: string): unknown => ({
  attestations: [
    {
      predicateType: 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1',
      bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify({ predicate: {} })).toString('base64') } },
    },
    {
      predicateType: 'https://slsa.dev/provenance/v1',
      bundle: {
        dsseEnvelope: {
          payload: Buffer.from(JSON.stringify({
            predicate: {
              buildDefinition: {
                resolvedDependencies: [
                  { uri: 'git+https://github.com/raduceuca/vibe-check@refs/heads/main', digest: { gitCommit } },
                ],
              },
            },
          })).toString('base64'),
        },
      },
    },
  ],
})

describe('npm dist-tags (REL-7)', () => {
  it('publishes stable versions as latest and prereleases as next', () => {
    expect(distTagFor('0.4.0')).toBe('latest')
    expect(distTagFor('0.4.0+build.7')).toBe('latest')
    expect(distTagFor('0.5.0-rc.1')).toBe('next')
    expect(distTagFor('1.0.0-beta+exp.sha.5114f85')).toBe('next')
  })

  it('always passes an explicit --tag to pnpm publish', async () => {
    const calls: string[][] = []
    const execFileImpl = async (_command: string, args: readonly string[]) => {
      calls.push([...args])
    }

    await publishPackage({ ...packages[0], version: '0.5.0-rc.1' }, { execFileImpl })
    await publishPackage(packages[0], { execFileImpl })

    expect(calls).toEqual([
      ['--filter', '@wcgw/vibe-check-core', 'publish', '--no-git-checks', '--tag', 'next'],
      ['--filter', '@wcgw/vibe-check-core', 'publish', '--no-git-checks', '--tag', 'latest'],
    ])
  })
})

describe('provenance-checked reruns (REL-14)', () => {
  it('reads the source commit from the SLSA provenance attestation', async () => {
    let requested = ''
    const commit = await readPublishedCommit(packages[0], {
      fetchImpl: async (url: string) => {
        requested = url
        return new Response(JSON.stringify(attestationsBody(COMMIT)), { status: 200 })
      },
    })

    expect(commit).toBe(COMMIT)
    expect(requested).toBe('https://registry.npmjs.org/-/npm/v1/attestations/%40wcgw%2Fvibe-check-core@0.4.0')
  })

  it('returns null for a version without provenance and throws on registry errors', async () => {
    const notFound = await readPublishedCommit(packages[0], {
      fetchImpl: async () => new Response('{}', { status: 404 }),
    })

    expect(notFound).toBeNull()
    await expect(readPublishedCommit(packages[0], {
      fetchImpl: async () => new Response('{}', { status: 503 }),
    })).rejects.toThrow('503')
  })

  it('accepts a package built from the same commit', async () => {
    const verify = createCommitVerifier({ expectedCommit: COMMIT, readCommit: async () => COMMIT })

    await expect(verify(packages[0])).resolves.toBeUndefined()
  })

  it('refuses a package built from another commit or without provenance', async () => {
    const otherCommit = createCommitVerifier({ expectedCommit: 'a'.repeat(40), readCommit: async () => COMMIT })
    const noProvenance = createCommitVerifier({ expectedCommit: COMMIT, readCommit: async () => null })

    await expect(otherCommit(packages[1])).rejects.toThrow(`built from commit ${COMMIT}`)
    await expect(otherCommit(packages[1])).rejects.toThrow('new patch version')
    await expect(noProvenance(packages[1])).rejects.toThrow('no npm provenance')
  })

  it('verifies every existing package before publishing anything', async () => {
    const published: string[] = []

    await expect(publishMissingPackages({
      packages,
      packageExists: async (pkg: { name: string }) => pkg.name === '@wcgw/vibe-check',
      publishPackage: async (pkg: { name: string }) => { published.push(pkg.name) },
      log: () => undefined,
      verifyPublished: createCommitVerifier({ expectedCommit: 'b'.repeat(40), readCommit: async () => COMMIT }),
    })).rejects.toThrow('Nothing was published')

    expect(published).toEqual([])
  })

  it('finishes a release when the existing packages match this commit', async () => {
    const published: string[] = []
    const verified: string[] = []

    const results = await publishMissingPackages({
      packages,
      packageExists: async (pkg: { name: string }) => pkg.name === '@wcgw/vibe-check-core',
      publishPackage: async (pkg: { name: string }) => { published.push(pkg.name) },
      log: () => undefined,
      verifyPublished: async (pkg: { name: string }) => { verified.push(pkg.name) },
    })

    expect(verified).toEqual(['@wcgw/vibe-check-core'])
    expect(published).toEqual(['@wcgw/vibe-check-mcp', '@wcgw/vibe-check'])
    expect(results.map((result: { action: string }) => result.action)).toEqual(['skipped', 'published', 'published'])
  })
})
