import { describe, expect, it } from 'vitest'
import { cleanupRecording } from '../../e2e/mcp-roundtrip/helpers/cleanup.js'

describe('demo recording cleanup', () => {
  it('attempts every teardown in dependency-safe order when earlier steps reject', async () => {
    const calls: string[] = []
    const rejecting = (name: string) => async () => {
      calls.push(name)
      throw new Error(`${name} failed`)
    }

    await cleanupRecording({
      context: { close: rejecting('context') },
      client: { close: rejecting('client') },
      browser: { close: rejecting('browser') },
      processes: [
        { stop: rejecting('process-a') },
        { stop: rejecting('process-b') },
      ],
      fixture: { cleanup: rejecting('fixture') },
      recordingRoot: '/not-used-by-test',
      removeRecording: rejecting('recording-root'),
    })

    expect(calls).toEqual([
      'context',
      'client',
      'browser',
      'process-b',
      'process-a',
      'fixture',
      'recording-root',
    ])
  })
})
