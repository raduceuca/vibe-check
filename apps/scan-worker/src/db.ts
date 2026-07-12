import type { ValidRecord } from './lib/validate'
import { computeScore, generateSlug, toOrigin } from './lib/host'

// D1 access. Everything here returns new objects — no row is ever mutated.

// The public, hostname-only shape served to the site.
export interface BoardEntry {
  readonly host: string
  readonly seo: { readonly passed: number; readonly total: number }
  readonly aeo: { readonly passed: number; readonly total: number }
  readonly score: number
  readonly at: number
}

interface ScanRow {
  host: string
  seo_passed: number
  seo_total: number
  aeo_passed: number
  aeo_total: number
  score: number
  created_at: number
}

const rowToEntry = (row: ScanRow): BoardEntry => ({
  host: row.host,
  seo: { passed: row.seo_passed, total: row.seo_total },
  aeo: { passed: row.aeo_passed, total: row.aeo_total },
  score: row.score,
  at: row.created_at,
})

export interface RecordResult {
  readonly slug: string
  readonly rank: number
  readonly score: number
}

// Upsert one row per host (latest scan wins), keeping the original id + slug so
// the share link stays stable across re-scans. Returns the host's leaderboard
// rank (1 = best) computed from the freshly written score.
export const recordScan = async (db: D1Database, record: ValidRecord): Promise<RecordResult> => {
  const score = computeScore(
    record.seo.passed,
    record.seo.total,
    record.aeo.passed,
    record.aeo.total,
  )
  const id = crypto.randomUUID()
  const slug = generateSlug()
  const createdAt = Date.now()
  const url = toOrigin(record.host)

  await db
    .prepare(
      `INSERT INTO scans
         (id, host, url, seo_passed, seo_total, aeo_passed, aeo_total, score, created_at, slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(host) DO UPDATE SET
         url        = excluded.url,
         seo_passed = excluded.seo_passed,
         seo_total  = excluded.seo_total,
         aeo_passed = excluded.aeo_passed,
         aeo_total  = excluded.aeo_total,
         score      = excluded.score,
         created_at = excluded.created_at`,
    )
    .bind(
      id,
      record.host,
      url,
      record.seo.passed,
      record.seo.total,
      record.aeo.passed,
      record.aeo.total,
      score,
      createdAt,
      slug,
    )
    .run()

  // Read back the persisted slug (unchanged on re-scan) and compute the rank.
  const persisted = await db
    .prepare('SELECT slug FROM scans WHERE host = ?')
    .bind(record.host)
    .first<{ slug: string }>()

  const ahead = await db
    .prepare('SELECT COUNT(*) AS c FROM scans WHERE score > ?')
    .bind(score)
    .first<{ c: number }>()

  return {
    slug: persisted?.slug ?? slug,
    rank: (ahead?.c ?? 0) + 1,
    score,
  }
}

const clampLimit = (raw: string | undefined, fallback: number, max: number): number => {
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

// Top hosts by score (best first), ties broken by most-recent scan.
export const getLeaderboard = async (
  db: D1Database,
  limitRaw: string | undefined,
): Promise<BoardEntry[]> => {
  const limit = clampLimit(limitRaw, 20, 50)
  const result = await db
    .prepare(
      `SELECT host, seo_passed, seo_total, aeo_passed, aeo_total, score, created_at
       FROM scans
       ORDER BY score DESC, created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<ScanRow>()
  return (result.results ?? []).map(rowToEntry)
}

// Most recently scanned hosts (already distinct — one row per host).
export const getRecent = async (
  db: D1Database,
  limitRaw: string | undefined,
): Promise<BoardEntry[]> => {
  const limit = clampLimit(limitRaw, 12, 50)
  const result = await db
    .prepare(
      `SELECT host, seo_passed, seo_total, aeo_passed, aeo_total, score, created_at
       FROM scans
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(limit)
    .all<ScanRow>()
  return (result.results ?? []).map(rowToEntry)
}
