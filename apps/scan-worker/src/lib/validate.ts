import { toHost } from './host'

// Hand-rolled validation for the /record body (the worker keeps zero non-hono
// deps, so no zod here). Anything malformed is rejected before it touches D1.

export interface ScorePair {
  readonly passed: number
  readonly total: number
}

export interface ValidRecord {
  readonly host: string
  readonly seo: ScorePair
  readonly aeo: ScorePair
}

// Audits can't realistically exceed this; a sane upper bound stops a caller
// stuffing huge numbers to game the score.
const MAX_TOTAL = 200

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parsePair = (value: unknown): ScorePair | null => {
  if (!isRecord(value)) return null
  const { passed, total } = value
  if (
    typeof passed !== 'number' ||
    typeof total !== 'number' ||
    !Number.isInteger(passed) ||
    !Number.isInteger(total)
  ) {
    return null
  }
  if (total < 0 || total > MAX_TOTAL) return null
  if (passed < 0 || passed > total) return null
  return { passed, total }
}

export const validateRecord = (
  body: unknown,
): { ok: true; value: ValidRecord } | { ok: false; error: string } => {
  if (!isRecord(body)) return { ok: false, error: 'Body must be a JSON object.' }

  const seo = parsePair(body.seo)
  if (!seo) return { ok: false, error: 'seo must be { passed, total } integers with 0 <= passed <= total.' }

  const aeo = parsePair(body.aeo)
  if (!aeo) return { ok: false, error: 'aeo must be { passed, total } integers with 0 <= passed <= total.' }

  if (seo.total + aeo.total <= 0) {
    return { ok: false, error: 'A scan needs at least one check.' }
  }

  // Prefer the explicit host, fall back to the url; both are reduced to a bare
  // hostname (path/query/credentials dropped) before we trust either.
  const hostSource = typeof body.host === 'string' ? body.host : typeof body.url === 'string' ? body.url : ''
  const host = toHost(hostSource)
  if (!host) return { ok: false, error: 'A valid public host or url is required.' }

  return { ok: true, value: { host, seo, aeo } }
}
