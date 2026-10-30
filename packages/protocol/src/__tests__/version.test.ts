import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MCP_PACKAGE_SPEC, MCP_PACKAGE_VERSION } from '../index.js'

const readJson = (relative: string): { readonly name: string; readonly version: string } =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), 'utf8')) as {
    readonly name: string
    readonly version: string
  }

describe('generated MCP package version (P3)', () => {
  it('matches packages/mcp/package.json', () => {
    const mcp = readJson('../../../mcp/package.json')
    expect(MCP_PACKAGE_VERSION).toBe(mcp.version)
    expect(MCP_PACKAGE_SPEC).toBe(`${mcp.name}@${mcp.version}`)
  })

  it('is what the generator would write (gen-version --check)', () => {
    const script = fileURLToPath(new URL('../../scripts/gen-version.mjs', import.meta.url))
    expect(() => execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('is not a hand-edited literal in index.ts', () => {
    const source = readFileSync(new URL('../index.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/vibe-check-mcp@\d+\.\d+\.\d+/)
  })
})
