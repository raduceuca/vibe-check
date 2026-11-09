import { fileURLToPath } from 'node:url'

// REL-3 / REL-15: everything the release needs after `npm publish` is checked
// before it, because npm versions are immutable. The 0.3.0 run published to npm
// and then stopped at the site deploy for want of a Cloudflare token.

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])

const isLoopbackUrl = (value) => {
  try {
    const { hostname } = new URL(value)
    return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost') || hostname.startsWith('127.')
  } catch {
    return false
  }
}

const cloudflareErrors = (body) => (Array.isArray(body?.errors) ? body.errors : [])
  .map((error) => (typeof error?.message === 'string' ? error.message : null))
  .filter((message) => message !== null)

export const checkReleaseEnvironment = async ({
  env = process.env,
  fetchImpl = fetch,
  timeoutMs = 15_000,
} = {}) => {
  const problems = []
  const token = env.CLOUDFLARE_API_TOKEN?.trim() ?? ''
  const accountId = env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? ''

  if (token === '') problems.push('CLOUDFLARE_API_TOKEN is empty. Add it as a secret of the `production` environment.')
  if (accountId === '') problems.push('CLOUDFLARE_ACCOUNT_ID is empty. Add it as a secret of the `production` environment.')

  if (token !== '' && accountId !== '') {
    // Listing Workers needs a live token, the right account, and Workers
    // Scripts access, which is what the site deploy uses.
    try {
      const response = await fetchImpl(`${CLOUDFLARE_API}/accounts/${encodeURIComponent(accountId)}/workers/scripts`, {
        headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || body?.success !== true) {
        const detail = cloudflareErrors(body).join('; ') || `HTTP ${response.status}`
        problems.push(`Cloudflare rejected the deploy credentials (${detail}). Check that CLOUDFLARE_API_TOKEN can edit Workers Scripts in account CLOUDFLARE_ACCOUNT_ID.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      problems.push(`Could not reach the Cloudflare API to check the deploy credentials: ${message}`)
    }
  }

  const scanApi = env.NEXT_PUBLIC_SCAN_API?.trim() ?? ''
  if (scanApi !== '' && isLoopbackUrl(scanApi)) {
    problems.push(`NEXT_PUBLIC_SCAN_API is ${scanApi}. It is inlined into the public /scan page, so a local address would make every visitor's browser call their own machine. Leave it empty or point it at the deployed scan worker.`)
  }

  return problems
}

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const problems = await checkReleaseEnvironment()
  if (problems.length > 0) {
    process.stderr.write(`Release preflight failed; nothing was published:\n${problems.map((problem) => `- ${problem}`).join('\n')}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write('Release preflight passed: Cloudflare deploy credentials work and the scan API setting is safe.\n')
  }
}
