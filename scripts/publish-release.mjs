import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import {
  parseReleaseVersionArgs,
  readReleaseManifest,
  validateReleaseVersion,
} from './release-manifest.mjs'

const execFileAsync = promisify(execFile)

export const publishMissingPackages = async ({
  packages,
  packageExists,
  publishPackage,
  log,
}) => {
  const results = []
  for (const pkg of packages) {
    if (await packageExists(pkg)) {
      log(`${pkg.name}@${pkg.version} already exists; skipping`)
      results.push({ name: pkg.name, version: pkg.version, action: 'skipped' })
      continue
    }
    log(`Publishing ${pkg.name}@${pkg.version}`)
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

export const publishPackage = async (pkg, {
  execFileImpl = execFileAsync,
  timeoutMs = 5 * 60_000,
  writeError = (message) => process.stderr.write(message),
} = {}) => {
  try {
    await execFileImpl('pnpm', ['--filter', pkg.name, 'publish', '--no-git-checks'], {
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
  const results = await publishMissingPackages({
    packages,
    packageExists: registryHasPackage,
    publishPackage,
    log: (message) => process.stdout.write(`${message}\n`),
  })
  process.stdout.write(`${JSON.stringify(results)}\n`)
}
