import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  RELEASE_PACKAGES,
  parseReleaseVersionArgs,
  readReleaseManifest,
  validateReleaseVersion,
} from './release-manifest.mjs'

const execFileAsync = promisify(execFile)

// REL-6: pack each public package exactly as `pnpm publish` would (workspace
// ranges rewritten) and assert what is inside the tarball. This replaces
// `pnpm -r publish --dry-run`, which silently skips any version already on npm
// and asserts nothing about contents.

const PRIVATE_WORKSPACE_PACKAGES = ['@wcgw/vibe-check-protocol']
const RUNTIME_DEPENDENCY_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies']
const ALL_DEPENDENCY_FIELDS = [...RUNTIME_DEPENDENCY_FIELDS, 'devDependencies']
const ROOT_FILES = new Set(['package.json', 'README.md', 'LICENSE'])
const CODE_FILE = /\.(?:c|m)?js$|\.d\.(?:c|m)?ts$/
const PRIVATE_IMPORT = new RegExp(`['"](?:${PRIVATE_WORKSPACE_PACKAGES.map((name) => name.replace('/', '\\/')).join('|')})(?:\\/[^'"]*)?['"]`)

const stripDotSlash = (path) => path.replace(/^\.\//, '')

const collectEntryPoints = (manifest) => {
  const entries = []
  const visitExports = (value) => {
    if (typeof value === 'string') entries.push(value)
    else if (value && typeof value === 'object') Object.values(value).forEach(visitExports)
  }
  for (const field of ['main', 'module', 'types', 'typings']) {
    if (typeof manifest[field] === 'string') entries.push(manifest[field])
  }
  visitExports(manifest.exports)
  const bins = typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {})
  return { entries: [...new Set([...entries, ...bins].map(stripDotSlash))], bins: bins.map(stripDotSlash) }
}

// Images inside HTML comments do not render, so they are not checked.
const readmeImageSources = (readme) => {
  const visible = readme.replace(/<!--[\s\S]*?-->/g, '')
  return [...new Set([
    ...[...visible.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)].map((match) => match[1]),
    ...[...visible.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]),
  ])]
}

// Pure check over an unpacked tarball. `files` are paths relative to the
// tarball's `package/` directory; `readText` reads one of them.
export const inspectPackedPackage = async ({ name, version, files, manifest, readText }) => {
  const problems = []
  const fileSet = new Set(files)

  if (manifest.name !== name) problems.push(`package.json name is ${manifest.name}, expected ${name}`)
  if (manifest.version !== version) problems.push(`package.json version is ${manifest.version}, expected ${version}`)

  for (const required of ROOT_FILES) {
    if (!fileSet.has(required)) problems.push(`missing ${required}`)
  }
  const distFiles = files.filter((file) => file.startsWith('dist/'))
  if (distFiles.length === 0) problems.push('no files under dist/ (was the package built?)')

  for (const file of files) {
    if (!ROOT_FILES.has(file) && !file.startsWith('dist/')) problems.push(`unexpected file ${file}`)
    if (/(?:^|\/)__tests__\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) problems.push(`test file shipped: ${file}`)
  }

  for (const field of ALL_DEPENDENCY_FIELDS) {
    for (const [dependency, range] of Object.entries(manifest[field] ?? {})) {
      if (String(range).startsWith('workspace:')) problems.push(`${field}.${dependency} still uses ${range}`)
    }
  }
  for (const field of RUNTIME_DEPENDENCY_FIELDS) {
    for (const dependency of Object.keys(manifest[field] ?? {})) {
      if (PRIVATE_WORKSPACE_PACKAGES.includes(dependency)) {
        problems.push(`${field} lists the private package ${dependency}; it must be bundled`)
      }
    }
  }
  for (const sibling of RELEASE_PACKAGES) {
    const range = manifest.dependencies?.[sibling.name]
    if (range !== undefined && ![version, `^${version}`, `~${version}`].includes(range)) {
      problems.push(`dependencies.${sibling.name} is ${range}; expected the release version ${version}`)
    }
  }
  if (name === '@wcgw/vibe-check-core' && Object.keys(manifest.dependencies ?? {}).length > 0) {
    problems.push(`core must have zero runtime dependencies; found ${Object.keys(manifest.dependencies).join(', ')}`)
  }

  const { entries, bins } = collectEntryPoints(manifest)
  for (const entry of entries) {
    if (!fileSet.has(entry)) problems.push(`entry point ${entry} is not in the tarball`)
  }
  for (const bin of bins) {
    if (fileSet.has(bin) && !(await readText(bin)).startsWith('#!')) problems.push(`bin ${bin} has no shebang`)
  }

  for (const file of distFiles.filter((path) => CODE_FILE.test(path))) {
    const text = await readText(file)
    if (PRIVATE_IMPORT.test(text)) problems.push(`${file} imports a private workspace package`)
    const sourceMapComments = text.match(/^\/\/# sourceMappingURL=/gm)?.length ?? 0
    if (sourceMapComments > 1) problems.push(`${file} has ${sourceMapComments} sourceMappingURL comments; expected at most 1`)
  }

  // P4: Next.js App Router needs the directive on every published JS entry.
  if (name === '@wcgw/vibe-check') {
    for (const entry of ['dist/index.js', 'dist/index.cjs']) {
      if (!fileSet.has(entry)) continue
      const text = await readText(entry)
      if (!text.startsWith("'use client';") && !text.startsWith('"use client";')) {
        problems.push(`${entry} is missing a leading 'use client' directive`)
      }
    }
  }

  if (fileSet.has('README.md')) {
    for (const source of readmeImageSources(await readText('README.md'))) {
      if (!/^https?:\/\//.test(source)) {
        problems.push(`README.md image ${source} is a relative path; npm cannot render it`)
      }
    }
  }

  return problems
}

const listFiles = async (directory, root = directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(path, root) : [relative(root, path).split(sep).join('/')]
  }))
  return nested.flat().sort()
}

export const packAndInspect = async (pkg, version, {
  root = process.cwd(),
  execFileImpl = execFileAsync,
} = {}) => {
  const destination = await mkdtemp(join(tmpdir(), 'vibe-check-pack-'))
  try {
    // pnpm pack runs no publish lifecycle scripts (no prepublishOnly rebuild or
    // retest); none of the packages define prepack/postpack.
    await execFileImpl('pnpm', ['--filter', pkg.name, 'pack', '--pack-destination', destination], { cwd: root })
    const tarball = (await readdir(destination)).find((file) => file.endsWith('.tgz'))
    if (!tarball) return { files: [], problems: ['pnpm pack produced no tarball'] }
    await execFileImpl('tar', ['-xzf', join(destination, tarball), '-C', destination])
    const packageRoot = join(destination, 'package')
    const files = await listFiles(packageRoot)
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    const problems = await inspectPackedPackage({
      name: pkg.name,
      version,
      files,
      manifest,
      readText: (file) => readFile(join(packageRoot, file), 'utf8'),
    })
    return { files, problems }
  } finally {
    await rm(destination, { recursive: true, force: true })
  }
}

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const args = process.argv.slice(2).filter((value) => value !== '--')
  const manifest = await readReleaseManifest()
  const version = args.length > 0 ? parseReleaseVersionArgs(args) : manifest[0].version
  validateReleaseVersion(manifest, version)
  let failed = false
  for (const pkg of manifest) {
    const { files, problems } = await packAndInspect(pkg, version)
    if (problems.length === 0) {
      process.stdout.write(`PASS ${pkg.name}@${version} (${files.length} files)\n`)
    } else {
      failed = true
      process.stdout.write(`FAIL ${pkg.name}@${version}\n${problems.map((problem) => `  - ${problem}`).join('\n')}\n`)
    }
  }
  if (failed) process.exitCode = 1
}
