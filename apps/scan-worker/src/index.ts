import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from './env'
import { recordRoute } from './routes/record'
import { boardRoutes } from './routes/board'

// VibeCheck scan history + leaderboard worker. Stores hostname-only scan scores
// (write path secret-guarded) and serves a leaderboard + recent feed for the
// /scan page. D1-only — no R2, AI, or browser rendering.

const app = new Hono<{ Bindings: Env }>()

// Reads are called cross-origin from the site; localhost:3200 (Next dev) is
// always allowed, plus the configured production origin.
const DEV_ORIGINS = ['http://localhost:3200', 'http://localhost:3000']

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const prod = (c.env as Env).ALLOWED_ORIGIN
      const allowed = prod ? [...DEV_ORIGINS, prod] : DEV_ORIGINS
      if (!origin) return origin
      return allowed.includes(origin) ? origin : null
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-Scan-Secret'],
  }),
)

app.get('/health', (c) => c.json({ status: 'ok' }))

app.route('/', recordRoute)
app.route('/', boardRoutes)

app.notFound((c) => c.json({ error: 'Not Found' }, 404))

app.onError((err, c) => {
  console.error('worker error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

export default app
