import { NextResponse } from 'next/server'
import { runScan } from '@/lib/scan/runScan'
import { recordScan } from '@/lib/scan/record'
import { ScanError } from '@/lib/scan/ssrf'

// ── POST /api/scan ───────────────────────────────────────────────────────────
// Body: { url: string }. Returns the SEO + AEO scorecard for the served HTML of
// a public URL. Node runtime (needs dns + net for the SSRF guard). All
// user-fixable failures return a clean 4xx with a safe message; unexpected
// errors return a generic 500 and never leak internals.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_URL_LENGTH = 2048

const errorResponse = (message: string, status: number): NextResponse =>
  NextResponse.json({ error: message }, { status })

export const POST = async (request: Request): Promise<NextResponse> => {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Send a JSON body like { "url": "https://example.com" }.', 400)
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return errorResponse('Send a JSON object with a "url" field.', 400)
  }

  const url = (body as Record<string, unknown>).url
  if (typeof url !== 'string' || url.trim().length === 0) {
    return errorResponse('Enter a URL to scan.', 400)
  }
  if (url.length > MAX_URL_LENGTH) {
    return errorResponse('That URL is too long.', 400)
  }

  try {
    const result = await runScan(url)
    // Record the successful scan on the shared leaderboard (best-effort, never
    // throws, secret-guarded server-to-server). Only fires when the scan-worker
    // env is configured; a recording failure cannot affect this response.
    await recordScan(result)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ScanError) {
      return errorResponse(error.message, error.status)
    }
    // Never leak internal errors to the client.
    return errorResponse("Couldn't scan that URL. Please try another.", 500)
  }
}
