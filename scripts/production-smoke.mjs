import { fileURLToPath } from 'node:url'

const DEFAULT_ORIGIN = 'https://vibecheck.wcgw.fun'

const routeSpecs = (origin) => [
  {
    path: '/',
    contentType: 'text/html',
    validate: ({ text }) => text.includes('<title>') && text.includes(origin),
    expectation: `HTML title and canonical origin ${origin}`,
  },
  {
    path: '/docs/quickstart',
    contentType: 'text/html',
    validate: ({ text }) => text.includes('@wcgw/vibe-check-mcp'),
    expectation: 'quickstart MCP package instructions',
  },
  {
    path: '/robots.txt',
    contentType: 'text/plain',
    validate: ({ text }) => text.includes(`Sitemap: ${origin}/sitemap.xml`),
    expectation: `Sitemap: ${origin}/sitemap.xml`,
  },
  {
    path: '/sitemap.xml',
    contentType: 'application/xml',
    validate: ({ text }) => text.includes(`<loc>${origin}/`),
    expectation: `<loc>${origin}/`,
  },
  {
    path: '/llms.txt',
    contentType: 'text/plain',
    validate: ({ text }) => text.includes('VibeCheck'),
    expectation: 'VibeCheck product content',
  },
  {
    path: '/opengraph-image',
    contentType: 'image/png',
    validate: ({ bytes }) => bytes >= 1_024,
    expectation: 'PNG payload of at least 1024 bytes',
  },
]

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const failure = (path, attempts, reason, status = null) => ({
  path,
  ok: false,
  attempts,
  status,
  reason,
})

const checkRoute = async ({
  origin,
  spec,
  fetchImpl,
  attempts,
  retryDelayMs,
  sleep,
}) => {
  let lastFailure = failure(spec.path, 0, 'check did not run')
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(`${origin}${spec.path}`, { redirect: 'follow' })
      const contentType = response.headers.get('content-type') ?? ''
      const buffer = Buffer.from(await response.arrayBuffer())
      const text = spec.contentType === 'image/png' ? '' : buffer.toString('utf8')
      if (response.status !== 200) {
        lastFailure = failure(spec.path, attempt, `expected HTTP 200, received ${response.status}`, response.status)
      } else if (!contentType.includes(spec.contentType)) {
        lastFailure = failure(
          spec.path,
          attempt,
          `expected content-type ${spec.contentType}, received ${contentType || '(missing)'}`,
          response.status,
        )
      } else if (!spec.validate({ text, bytes: buffer.length })) {
        lastFailure = failure(spec.path, attempt, `missing ${spec.expectation}`, response.status)
      } else {
        return {
          path: spec.path,
          ok: true,
          attempts: attempt,
          status: response.status,
          reason: null,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      lastFailure = failure(spec.path, attempt, `request failed: ${message}`)
    }

    if (attempt < attempts && retryDelayMs > 0) await sleep(retryDelayMs)
  }
  return lastFailure
}

export const runProductionSmoke = async ({
  origin = DEFAULT_ORIGIN,
  fetchImpl = fetch,
  retries = 3,
  retryDelayMs = 1_500,
  sleep = wait,
} = {}) => {
  const normalizedOrigin = origin.replace(/\/$/, '')
  const attempts = Math.max(1, retries)
  return Promise.all(routeSpecs(normalizedOrigin).map((spec) => checkRoute({
    origin: normalizedOrigin,
    spec,
    fetchImpl,
    attempts,
    retryDelayMs,
    sleep,
  })))
}

export const formatSmokeResults = (results) => results.map((result) => {
  const attempts = result.attempts === 1 ? '1 attempt' : `${result.attempts} attempts`
  return result.ok
    ? `PASS ${result.path} (${result.status}, ${attempts})`
    : `FAIL ${result.path} (${result.status ?? 'no response'}, ${attempts}): ${result.reason}`
}).join('\n')

const isCli = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

if (isCli) {
  const results = await runProductionSmoke({ origin: process.argv[2] ?? DEFAULT_ORIGIN })
  process.stdout.write(`${formatSmokeResults(results)}\n`)
  if (results.some((result) => !result.ok)) process.exitCode = 1
}
