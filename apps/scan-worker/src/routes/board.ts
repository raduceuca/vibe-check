import { Hono } from 'hono'
import type { Env } from '../env'
import { getLeaderboard, getRecent } from '../db'

// Public read paths. Both return hostname-only entries — no full urls, paths, or
// query strings ever leave the database.
export const boardRoutes = new Hono<{ Bindings: Env }>()

// GET /leaderboard?limit=20 — top hosts by combined score.
boardRoutes.get('/leaderboard', async (c) => {
  const entries = await getLeaderboard(c.env.DB, c.req.query('limit'))
  return c.json({ entries, count: entries.length })
})

// GET /recent?limit=12 — most recently scanned hosts (distinct by host).
boardRoutes.get('/recent', async (c) => {
  const entries = await getRecent(c.env.DB, c.req.query('limit'))
  return c.json({ entries, count: entries.length })
})
