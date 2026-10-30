import { execFile } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const RELEASE_PACKAGES = [
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

// ── Version pins in docs (REL-2) ────────────────────────────────────────────
// Every `@wcgw/vibe-check*@X.Y.Z` a reader can copy must name the version being
// released. apps/web is checked separately once the site is regenerated, and
// docs/superpowers holds dated design records that keep their historical pins.

const PIN = /@wcgw\/(vibe-check(?:-core|-mcp)?)@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]*[0-9A-Za-z])?)/g
const TEXT_EXTENSIONS = new Set(['.md', '.mdx', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.txt', '.yml', '.yaml'])
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', '.git', '.vite', 'coverage'])

export const findVersionPins = (text) => text.split('\n').flatMap((content, index) => (
  [...content.matchAll(PIN)].map((match) => ({
    line: index + 1,
    spec: match[0],
    name: `@wcgw/${match[1]}`,
    version: match[2],
  }))
))

const extensionOf = (path) => {
  const dot = path.lastIndexOf('.')
  return dot === -1 ? '' : path.slice(dot)
}

// Symlinked entries (for example third-party skills linked into skills/) are
// neither files nor directories to readdir, so they are never scanned.
const walkTextFiles = async (directory) => {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : walkTextFiles(path)
    return entry.isFile() && TEXT_EXTENSIONS.has(extensionOf(entry.name)) ? [path] : []
  }))
  return nested.flat()
}

export const listPinnedDocuments = async (root = process.cwd()) => {
  const packageDirectories = await readdir(join(root, 'packages'), { withFileTypes: true }).catch(() => [])
  const packageReadmes = packageDirectories
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, 'packages', entry.name, 'README.md'))
  const [skills, demo, launch] = await Promise.all([
    walkTextFiles(join(root, 'skills')),
    walkTextFiles(join(root, 'demo')),
    walkTextFiles(join(root, 'docs', 'launch')),
  ])
  const candidates = [
    join(root, 'README.md'),
    ...packageReadmes,
    ...skills.filter((path) => path.endsWith(`${sep}SKILL.md`)),
    ...demo,
    ...launch,
  ]
  const existing = await Promise.all(candidates.map(async (path) => (
    (await readFile(path, 'utf8').then(() => true, () => false)) ? path : null
  )))
  return existing
    .filter((path) => path !== null)
    .map((path) => relative(root, path).split(sep).join('/'))
    .sort()
}

export const findStaleVersionPins = async (root, version) => {
  const documents = await listPinnedDocuments(root)
  const perDocument = await Promise.all(documents.map(async (path) => (
    findVersionPins(await readFile(join(root, path), 'utf8'))
      .filter((pin) => pin.version !== version)
      .map((pin) => ({ path, line: pin.line, spec: pin.spec }))
  )))
  return { documents, stale: perDocument.flat() }
}

// ── CHANGELOG section (P8, REL-16) ──────────────────────────────────────────
// The GitHub release notes are this section, so a release cannot ship without it.

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const readChangelogSection = (changelog, version) => {
  const heading = new RegExp(`^## \\[?v?${escapeRegExp(version)}\\]?(?:\\s|$)`)
  const lines = changelog.split('\n')
  const start = lines.findIndex((line) => heading.test(line))
  if (start === -1) return null
  const rest = lines.slice(start + 1)
  const end = rest.findIndex((line) => line.startsWith('## '))
  const body = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim()
  return body.length > 0 ? body : null
}

// ── Generated protocol version (P3) ─────────────────────────────────────────

export const checkGeneratedVersion = async (root = process.cwd(), {
  execFileImpl = execFileAsync,
} = {}) => {
  try {
    await execFileImpl(process.execPath, ['packages/protocol/scripts/gen-version.mjs', '--check'], { cwd: root })
    return null
  } catch (error) {
    const stderr = typeof error === 'object' && error !== null && typeof error.stderr === 'string' ? error.stderr.trim() : ''
    return stderr || 'packages/protocol/src/version.generated.ts is stale. Run `pnpm --filter @wcgw/vibe-check-protocol gen:version`.'
  }
}

// ── Whole readiness check ───────────────────────────────────────────────────

export const checkReleaseReadiness = async ({
  root = process.cwd(),
  version,
  checkGenerated = checkGeneratedVersion,
}) => {
  const problems = []
  let manifest = []
  try {
    manifest = validateReleaseVersion(await readReleaseManifest(root), version)
  } catch (error) {
    problems.push(error instanceof Error ? error.message : String(error))
  }

  const { documents, stale } = await findStaleVersionPins(root, version)
  for (const pin of stale) {
    problems.push(`${pin.path}:${pin.line} pins ${pin.spec}; expected @${version}`)
  }

  const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8').catch(() => '')
  if (readChangelogSection(changelog, version) === null) {
    problems.push(`CHANGELOG.md has no "## ${version}" section with release notes`)
  }

  const generated = await checkGenerated(root)
  if (generated !== null) problems.push(generated)

  return { manifest, documents, problems }
}

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const expectedVersion = parseReleaseVersionArgs(process.argv.slice(2))
  const { manifest, documents, problems } = await checkReleaseReadiness({ version: expectedVersion })
  if (problems.length > 0) {
    process.stderr.write(`Release ${expectedVersion} is not ready:\n${problems.map((problem) => `- ${problem}`).join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write([
      ...manifest.map((pkg) => `${pkg.name}@${pkg.version}`),
      `version pins match ${expectedVersion} in ${documents.length} documents`,
      `CHANGELOG.md has a ${expectedVersion} section`,
      'packages/protocol/src/version.generated.ts is current',
    ].join('\n') + '\n')
  }
}
