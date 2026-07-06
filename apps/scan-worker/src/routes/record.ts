import { Hono } from 'hono'
import type { Env } from '../env'
import { validateRecord } from '../lib/validate'
import { allowWrite } from '../lib/rateLimit'
import { recordScan } from '../db'

// POST /record — write path. Secret-guarded so only the VibeCheck server can
// record scores; the public can never spoof the board.
export const recordRoute = new Hono<{ Bindings: Env }>()

recordRoute.post('/record', async (c) => {
  // Shared-secret guard. Constant-ish comparison is fine here (secret is a
  // server-held credential, not a per-request token).
  const provided = c.req.header('x-scan-secret')
  if (!c.env.SCAN_SECRET || provided !== c.env.SCAN_SECRET) {
    return c.json({ ok: false, error: 'Unauthorized' }, 401)
  }

  const ip =
    c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown'
  if (!allowWrite(ip)) {
    return c.json({ ok: false, error: 'Too many writes, slow down.' }, 429)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ ok: false, error: 'Invalid JSON body.' }, 400)
  }

  const parsed = validateRecord(body)
  if (!parsed.ok) {
    return c.json({ ok: false, error: parsed.error }, 400)
  }

  try {
    const { slug, rank } = await recordScan(c.env.DB, parsed.value)
    return c.json({ ok: true, slug, rank })
  } catch (error) {
    console.error('record failed:', error)
    return c.json({ ok: false, error: 'Could not record scan.' }, 500)
  }
})
