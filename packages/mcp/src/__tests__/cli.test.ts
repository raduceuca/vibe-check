import { describe, expect, it } from 'vitest'
import { parseCliConfig } from '../cli.js'

describe('parseCliConfig', () => {
  it('parses the hub role with bounded port fallback', () => {
    expect(parseCliConfig(['hub'], { VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json' })).toEqual({
      role: 'hub',
      host: '127.0.0.1',
      port: 4200,
      registryPath: '/tmp/projects.json',
    })
    expect(parseCliConfig(['hub'], { VIBE_CHECK_PORT: '4312', VIBE_CHECK_HOST: '::1' })).toEqual({
      role: 'hub',
      host: '::1',
      port: 4312,
      registryPath: expect.any(String),
    })
    expect(parseCliConfig(['hub'], { VIBE_CHECK_PORT: '99999' })).toMatchObject({ port: 4200 })
  })

  it('parses the stdio bridge role', () => {
    expect(parseCliConfig(['connect'], {})).toEqual({
      role: 'connect',
      hubUrl: 'http://127.0.0.1:4200',
    })
  })

  it('parses doctor defaults and explicit project JSON output', () => {
    expect(parseCliConfig(['doctor'], {})).toEqual({
      role: 'doctor',
      hubUrl: 'http://127.0.0.1:4200',
      projectId: undefined,
      json: false,
    })
    expect(parseCliConfig(['doctor', '--project', 'storefront', '--json'], {
      VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4210',
    })).toEqual({
      role: 'doctor',
      hubUrl: 'http://127.0.0.1:4210',
      projectId: 'storefront',
      json: true,
    })
  })

  it('parses setup with an agent and optional project controls', () => {
    expect(parseCliConfig(['setup', '--agent', 'codex'], {})).toEqual({
      role: 'setup',
      agent: 'codex',
      projectId: undefined,
      dryRun: false,
      force: false,
    })
    expect(parseCliConfig([
      'setup',
      '--agent',
      'cursor',
      '--project',
      'storefront',
      '--dry-run',
      '--force',
    ], {})).toEqual({
      role: 'setup',
      agent: 'cursor',
      projectId: 'storefront',
      dryRun: true,
      force: true,
    })
  })

  it('parses explicit project registration', () => {
    expect(parseCliConfig(['register', '--project', 'storefront'], {
      VIBE_CHECK_REGISTRY_PATH: '/tmp/projects.json',
    })).toEqual({
      role: 'register',
      projectId: 'storefront',
      root: '.',
      registryPath: '/tmp/projects.json',
    })
    expect(parseCliConfig([
      'register', '--project', 'admin', '--root', '/workspace/admin',
    ], {})).toMatchObject({
      role: 'register',
      projectId: 'admin',
      root: '/workspace/admin',
    })
    expect(() => parseCliConfig(['register', '--root', '/tmp'], {})).toThrow(
      'Register --project is required',
    )
  })

  it('parses project impact stats formats', () => {
    expect(parseCliConfig(['stats', '--project', 'storefront'], {})).toEqual({
      role: 'stats',
      hubUrl: 'http://127.0.0.1:4200',
      projectId: 'storefront',
      format: 'human',
    })
    expect(parseCliConfig(['stats', '--project', 'storefront', '--markdown'], {
      VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4210',
    })).toMatchObject({ format: 'markdown', hubUrl: 'http://127.0.0.1:4210' })
    expect(() => parseCliConfig(['stats', '--json'], {})).toThrow('Stats --project is required')
    expect(() => parseCliConfig([
      'stats', '--project', 'storefront', '--json', '--markdown',
    ], {})).toThrow('one output format')
  })

  it('rejects invalid, missing, unknown, and duplicate setup options', () => {
    expect(() => parseCliConfig(['setup'], {})).toThrow('Setup --agent is required')
    expect(() => parseCliConfig(['setup', '--agent'], {})).toThrow('requires an agent')
    expect(() => parseCliConfig(['setup', '--agent', 'windsurf'], {})).toThrow('Unknown setup agent')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--project'], {})).toThrow('requires a project ID')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--dry-run', '--dry-run'], {})).toThrow('Duplicate setup option')
    expect(() => parseCliConfig(['setup', '--agent', 'codex', '--unknown'], {})).toThrow('Unknown setup option')
  })

  it('rejects unknown, incomplete, and duplicate doctor options', () => {
    expect(() => parseCliConfig(['doctor', '--unknown'], {})).toThrow('Unknown doctor option')
    expect(() => parseCliConfig(['doctor', '--project'], {})).toThrow('requires a project ID')
    expect(() => parseCliConfig(['doctor', '--json', '--json'], {})).toThrow('Duplicate doctor option')
    expect(() => parseCliConfig(['doctor', '--project', 'a', '--project', 'b'], {})).toThrow('Duplicate doctor option')
  })

  it('rejects a missing or unknown role', () => {
    expect(() => parseCliConfig([], {})).toThrow('vibe-check-mcp setup --agent')
    expect(() => parseCliConfig(['serve'], {})).toThrow('vibe-check-mcp setup --agent')
  })
})
