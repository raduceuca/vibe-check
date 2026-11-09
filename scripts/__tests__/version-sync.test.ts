import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  HUB_START_COMMAND,
  MCP_PACKAGE_SPEC,
  MCP_TOOL_CATALOG,
  getAgentClientSetup,
  getWatchInstruction,
} from '../../packages/protocol/src/index.js'
import { findStaleVersionPins } from '../release-manifest.mjs'

// Release gate R0 / P3: every setup command the widget, CLI and docs print is
// built from MCP_PACKAGE_SPEC, so the spec must be the version that ships, and
// that version must actually have the `up` command those commands advertise.

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const packageJson = (directory: string): { readonly name: string; readonly version: string } =>
  JSON.parse(read(`${directory}/package.json`)) as { readonly name: string; readonly version: string }

describe('MCP package spec matches the package that ships', () => {
  it('pins the version from packages/mcp/package.json', () => {
    const mcp = packageJson('packages/mcp')
    expect(MCP_PACKAGE_SPEC).toBe(`${mcp.name}@${mcp.version}`)
    expect(MCP_PACKAGE_SPEC.split('@').at(-1)).toBe(mcp.version)
  })

  it('keeps all four workspace packages in lockstep', () => {
    const versions = ['packages/core', 'packages/mcp', 'packages/react', 'packages/protocol']
      .map((directory) => packageJson(directory).version)
    expect(new Set(versions).size).toBe(1)
  })

  it('ships the `up` command that the pinned setup commands use', () => {
    const cli = read('packages/mcp/src/cli.ts')
    expect(cli).toMatch(/vibe-check-mcp up\b/)
    expect(cli).toMatch(/role === 'up'/)
  })
})

// Moved here from packages/protocol (it reads files the protocol package does
// not own). Owned by release-docs from 0.4.0: it stays red until the README
// and skill pins are regenerated from MCP_PACKAGE_SPEC.
describe('first-class client setup docs match the protocol', () => {
  const documents = [
    'README.md',
    'packages/mcp/README.md',
    'packages/react/README.md',
    'demo/README.md',
    'skills/vibe-check/SKILL.md',
  ].map((path) => ({ path, text: read(path) }))

  it('name every first-class client', () => {
    for (const { text } of documents) {
      expect(text).toContain('Codex')
      expect(text).toContain('Claude Code')
      expect(text).toContain('Cursor')
    }
  })

  it('print the exact pinned commands in the primary docs', () => {
    for (const { text } of documents.slice(0, 2)) {
      expect(text).toContain(HUB_START_COMMAND)
      expect(text).toContain(getAgentClientSetup('codex').value)
      expect(text).toContain(getAgentClientSetup('claude-code').value)
      expect(text).toContain(getAgentClientSetup('cursor').value)
      expect(text).toContain('doctor --project')
      expect(text).toContain(getWatchInstruction('docs-project').split('project_id')[0])
    }
    const mcpReadme = documents[1]?.text ?? ''
    expect(mcpReadme).toContain('Merge the `vibe-check` entry into `mcpServers`')
    expect(mcpReadme).toContain('**ready** — exits `0`')
    expect(mcpReadme).toContain('**stale** —')
    expect(mcpReadme).toContain('**missing** —')
  })
})

// REL-2: the same scan `pnpm release:validate` runs, against the real repo, so
// a stale pin fails `pnpm test` long before a release is dispatched.
describe('copyable version pins match the package that ships', () => {
  it('pin only the version MCP_PACKAGE_SPEC names', async () => {
    const { version } = packageJson('packages/mcp')
    const { documents, stale } = await findStaleVersionPins(fileURLToPath(new URL('../../', import.meta.url)), version)

    expect(documents).toContain('README.md')
    expect(documents).toContain('skills/vibe-check/SKILL.md')
    expect(stale).toEqual([])
  })
})

// SITE-04 / §3.7: the agent-facing docs repeat the tool catalog's own wording.
describe('agent docs match the MCP tool catalog', () => {
  it.each(['skills/vibe-check/SKILL.md', 'CLAUDE.md', 'AGENTS.md'])('%s lists all ten tools with their catalog descriptions', (path) => {
    const text = read(path)

    expect(MCP_TOOL_CATALOG).toHaveLength(10)
    for (const tool of MCP_TOOL_CATALOG) {
      expect(text).toContain(`\`${tool.name}\``)
      expect(text).toContain(tool.description)
    }
  })
})
