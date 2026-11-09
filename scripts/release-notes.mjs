import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseReleaseVersionArgs, readChangelogSection } from './release-manifest.mjs'

// Prints the CHANGELOG.md section for one version. release.yml passes it to
// `gh release create --notes-file`, so the GitHub release says what the
// CHANGELOG says instead of a generated commit list.

export const releaseNotesFor = async (version, root = process.cwd()) => {
  const changelog = await readFile(join(root, 'CHANGELOG.md'), 'utf8')
  const section = readChangelogSection(changelog, version)
  if (section === null) {
    throw new Error(`CHANGELOG.md has no "## ${version}" section with release notes`)
  }
  return `${section}\n`
}

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const version = parseReleaseVersionArgs(process.argv.slice(2))
  process.stdout.write(await releaseNotesFor(version))
}
