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

const registryHasPackage = async (pkg) => {
  const url = `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}`
  const response = await fetch(url, { headers: { accept: 'application/json' } })
  if (response.status === 200) return true
  if (response.status === 404) return false
  throw new Error(`npm registry returned ${response.status} for ${pkg.name}@${pkg.version}`)
}

const publishPackage = async (pkg) => {
  await execFileAsync('pnpm', ['--filter', pkg.name, 'publish', '--no-git-checks'], {
    cwd: process.cwd(),
    env: process.env,
  })
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
