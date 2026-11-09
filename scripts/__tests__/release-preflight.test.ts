import { describe, expect, it } from 'vitest'
import { checkReleaseEnvironment } from '../release-preflight.mjs'

const TOKEN = 'cf-token-value-that-must-not-leak'
const ACCOUNT = '0123456789abcdef0123456789abcdef'

interface Call {
  readonly url: string
  readonly authorization: string | null
}

const recordingFetch = (status: number, body: unknown) => {
  const calls: Call[] = []
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, authorization: new Headers(init?.headers).get('authorization') })
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  }
  return { calls, fetchImpl }
}

describe('release preflight (REL-3, REL-15)', () => {
  it('fails fast on empty Cloudflare secrets without calling Cloudflare', async () => {
    const { calls, fetchImpl } = recordingFetch(200, { success: true })

    const problems = await checkReleaseEnvironment({
      env: { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ACCOUNT_ID: '  ' },
      fetchImpl,
    })

    expect(problems).toEqual([
      'CLOUDFLARE_API_TOKEN is empty. Add it as a secret of the `production` environment.',
      'CLOUDFLARE_ACCOUNT_ID is empty. Add it as a secret of the `production` environment.',
    ])
    expect(calls).toEqual([])
  })

  it('verifies the token against the account the deploy uses', async () => {
    const { calls, fetchImpl } = recordingFetch(200, { success: true, result: [] })

    const problems = await checkReleaseEnvironment({
      env: { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT },
      fetchImpl,
    })

    expect(problems).toEqual([])
    expect(calls).toEqual([{
      url: `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts`,
      authorization: `Bearer ${TOKEN}`,
    }])
  })

  it('reports a rejected token with Cloudflare\'s reason and never echoes the token', async () => {
    const { fetchImpl } = recordingFetch(400, {
      success: false,
      errors: [{ code: 9106, message: 'Authentication failed (status: 400)' }],
    })

    const problems = await checkReleaseEnvironment({
      env: { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT },
      fetchImpl,
    })

    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('Authentication failed (status: 400)')
    expect(problems.join('\n')).not.toContain(TOKEN)
  })

  it('reports an unreachable Cloudflare API as a failure, not a pass', async () => {
    const problems = await checkReleaseEnvironment({
      env: { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT },
      fetchImpl: async () => { throw new Error('getaddrinfo ENOTFOUND') },
    })

    expect(problems).toEqual([expect.stringContaining('Could not reach the Cloudflare API')])
  })

  it('refuses a local scan API address that would be inlined into the public site', async () => {
    const { fetchImpl } = recordingFetch(200, { success: true })

    for (const value of ['http://localhost:8787', 'http://127.0.0.1:8787', 'http://scan.localhost']) {
      const problems = await checkReleaseEnvironment({
        env: { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, NEXT_PUBLIC_SCAN_API: value },
        fetchImpl,
      })
      expect(problems).toEqual([expect.stringContaining(`NEXT_PUBLIC_SCAN_API is ${value}`)])
    }

    expect(await checkReleaseEnvironment({
      env: { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, NEXT_PUBLIC_SCAN_API: 'https://scan.example.workers.dev' },
      fetchImpl,
    })).toEqual([])
  })
})
