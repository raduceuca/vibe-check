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

  it('rejects a missing or unknown role', () => {
    expect(() => parseCliConfig([], {})).toThrow('vibe-check-mcp hub | vibe-check-mcp connect')
    expect(() => parseCliConfig(['serve'], {})).toThrow('vibe-check-mcp hub | vibe-check-mcp connect')
  })
})
