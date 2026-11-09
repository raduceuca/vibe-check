import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  parseReleaseVersionArgs,
  readReleaseManifest,
  validateReleaseVersion,
} from './release-manifest.mjs'

const execFileAsync = promisify(execFile)

// A prerelease (0.4.0-rc.1) must never become what `npm i` and `npx …@latest`
// install. pnpm passes `--tag latest` explicitly when no tag is given, which
// skips npm's own prerelease guard, so the tag is always chosen here.
export const distTagFor = (version) => (version.split('+')[0].includes('-') ? 'next' : 'latest')

export const isPrerelease = (version) => distTagFor(version) === 'next'

// Every package that already exists is checked first (verifyPublished throws on
// a mismatch), so a rerun either publishes the missing packages from the same
// commit or publishes nothing at all.
export const publishMissingPackages = async ({
  packages,
  packageExists,
  publishPackage,
  log,
  verifyPublished,
}) => {
  const existing = []
  for (const pkg of packages) {
    existing.push(await packageExists(pkg))
  }
  if (verifyPublished) {
    for (const [index, pkg] of packages.entries()) {
      if (existing[index]) await verifyPublished(pkg)
    }
  }

  const results = []
  for (const [index, pkg] of packages.entries()) {
    if (existing[index]) {
      log(`${pkg.name}@${pkg.version} already exists; skipping`)
      results.push({ name: pkg.name, version: pkg.version, action: 'skipped' })
      continue
    }
    log(`Publishing ${pkg.name}@${pkg.version} with dist-tag ${distTagFor(pkg.version)}`)
    await publishPackage(pkg)
    results.push({ name: pkg.name, version: pkg.version, action: 'published' })
  }
  return results
}

export const registryHasPackage = async (pkg, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
} = {}) => {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.status === 200) return true
  if (response.status === 404) return false
  throw new Error(`npm registry returned ${response.status} for ${pkg.name}@${pkg.version}`)
}

const SLSA_PROVENANCE = 'https://slsa.dev/provenance/v1'

// Returns the git commit recorded in the package's npm provenance (SLSA v1),
// or null when the version has no provenance (published outside this workflow).
export const readPublishedCommit = async (pkg, {
  fetchImpl = fetch,
  timeoutMs = 15_000,
} = {}) => {
  const url = `https://registry.npmjs.org/-/npm/v1/attestations/${encodeURIComponent(pkg.name)}@${encodeURIComponent(pkg.version)}`
  const response = await fetchImpl(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (response.status === 404) return null
  if (response.status !== 200) {
    throw new Error(`npm attestations returned ${response.status} for ${pkg.name}@${pkg.version}`)
  }
  const body = await response.json()
  const attestations = Array.isArray(body?.attestations) ? body.attestations : []
  for (const attestation of attestations) {
    if (attestation?.predicateType !== SLSA_PROVENANCE) continue
    const payload = attestation?.bundle?.dsseEnvelope?.payload
    if (typeof payload !== 'string') continue
    const statement = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    const dependencies = statement?.predicate?.buildDefinition?.resolvedDependencies
    const commit = Array.isArray(dependencies)
      ? dependencies.map((dependency) => dependency?.digest?.gitCommit).find((value) => typeof value === 'string')
      : undefined
    if (commit) return commit
  }
  return null
}

// REL-14: a rerun may only finish a release from the commit npm already holds.
// A code fix needs a new patch version, otherwise the git tag would point at
// code that differs from the published tarballs and their provenance.
export const createCommitVerifier = ({ expectedCommit, readCommit = readPublishedCommit }) => async (pkg) => {
  const commit = await readCommit(pkg)
  if (commit === expectedCommit) return
  const source = commit === null ? 'an unknown commit (no npm provenance)' : `commit ${commit}`
  throw new Error(
    `${pkg.name}@${pkg.version} is already on npm, built from ${source}, but this run is commit ${expectedCommit}. `
    + 'Nothing was published. Re-run the failed jobs of the original run to finish this version, '
    + 'or release a new patch version if the fix needs a code change.',
  )
}

export const publishPackage = async (pkg, {
  execFileImpl = execFileAsync,
  timeoutMs = 5 * 60_000,
  writeError = (message) => process.stderr.write(message),
} = {}) => {
  try {
    await execFileImpl('pnpm', ['--filter', pkg.name, 'publish', '--no-git-checks', '--tag', distTagFor(pkg.version)], {
      cwd: process.cwd(),
      env: process.env,
      timeout: timeoutMs,
    })
  } catch (error) {
    const output = typeof error === 'object' && error !== null ? error : {}
    const stdout = typeof output.stdout === 'string' ? output.stdout : ''
    const stderr = typeof output.stderr === 'string' ? output.stderr : ''
    if (stdout.length > 0 || stderr.length > 0) {
      writeError(`Publish command output for ${pkg.name}@${pkg.version}:\n${stdout}${stderr}\n`)
    }
    throw error
  }
}

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const expectedVersion = parseReleaseVersionArgs(process.argv.slice(2))
  const packages = validateReleaseVersion(await readReleaseManifest(), expectedVersion)
  const expectedCommit = process.env.GITHUB_SHA
  if (!expectedCommit) {
    process.stdout.write('GITHUB_SHA is not set: already-published versions are not checked against npm provenance\n')
  }
  const results = await publishMissingPackages({
    packages,
    packageExists: registryHasPackage,
    publishPackage,
    log: (message) => process.stdout.write(`${message}\n`),
    verifyPublished: expectedCommit ? createCommitVerifier({ expectedCommit }) : undefined,
  })
  process.stdout.write(`${JSON.stringify(results)}\n`)
}
