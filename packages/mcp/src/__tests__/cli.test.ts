import { describe, expect, it } from 'vitest'
import { parseCliConfig } from '../cli.js'

describe('parseCliConfig', () => {
  it('parses the hub role with bounded port fallback', () => {
    expect(parseCliConfig(['hub'], {})).toEqual({ role: 'hub', host: '127.0.0.1', port: 4200 })
    expect(parseCliConfig(['hub'], { VIBE_CHECK_PORT: '4312', VIBE_CHECK_HOST: '::1' })).toEqual({
      role: 'hub',
      host: '::1',
      port: 4312,
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

  it('rejects unknown, incomplete, and duplicate doctor options', () => {
    expect(() => parseCliConfig(['doctor', '--unknown'], {})).toThrow('Unknown doctor option')
    expect(() => parseCliConfig(['doctor', '--project'], {})).toThrow('requires a project ID')
    expect(() => parseCliConfig(['doctor', '--json', '--json'], {})).toThrow('Duplicate doctor option')
    expect(() => parseCliConfig(['doctor', '--project', 'a', '--project', 'b'], {})).toThrow('Duplicate doctor option')
  })

  it('rejects a missing or unknown role', () => {
    expect(() => parseCliConfig([], {})).toThrow('vibe-check-mcp hub | vibe-check-mcp connect | vibe-check-mcp doctor')
    expect(() => parseCliConfig(['serve'], {})).toThrow('vibe-check-mcp hub | vibe-check-mcp connect | vibe-check-mcp doctor')
  })
})
