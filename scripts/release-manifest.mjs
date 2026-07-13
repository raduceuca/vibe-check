import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RELEASE_PACKAGES = [
  { name: '@wcgw/vibe-check-core', directory: 'packages/core' },
  { name: '@wcgw/vibe-check-mcp', directory: 'packages/mcp' },
  { name: '@wcgw/vibe-check', directory: 'packages/react' },
]

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

export const readReleaseManifest = async (root = process.cwd()) => Promise.all(
  RELEASE_PACKAGES.map(async ({ name, directory }) => {
    const packageJson = JSON.parse(await readFile(join(root, directory, 'package.json'), 'utf8'))
    if (packageJson.name !== name || typeof packageJson.version !== 'string') {
      throw new Error(`Invalid release package metadata in ${directory}/package.json`)
    }
    return { name, directory, version: packageJson.version }
  }),
)

export const validateReleaseVersion = (manifest, expectedVersion) => {
  if (!SEMVER.test(expectedVersion)) {
    throw new Error(`Release version "${expectedVersion}" is not a valid semantic version`)
  }
  const mismatches = manifest
    .filter((pkg) => pkg.version !== expectedVersion)
    .map((pkg) => `${pkg.name}=${pkg.version}`)
  if (mismatches.length > 0) {
    throw new Error(`Release version ${expectedVersion} does not match: ${mismatches.join(', ')}`)
  }
  return manifest
}

export const parseReleaseVersionArgs = (argv) => {
  const values = argv.filter((value) => value !== '--')
  if (values.length !== 1 || !values[0]) {
    throw new Error('Usage: release command <version>')
  }
  return values[0]
}

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const expectedVersion = parseReleaseVersionArgs(process.argv.slice(2))
  const manifest = validateReleaseVersion(await readReleaseManifest(), expectedVersion)
  process.stdout.write(`${manifest.map((pkg) => `${pkg.name}@${pkg.version}`).join('\n')}\n`)
}
