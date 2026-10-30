import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin, type Connect } from 'vite'
import react from '@vitejs/plugin-react'

const VIBES = ['smooth', 'light', 'clean', 'findable', 'quotable'] as const
type Vibe = (typeof VIBES)[number]

const parseFixed = (raw: string | undefined): Set<Vibe> => {
  const next = new Set<Vibe>()
  if (!raw) return next
  for (const part of decodeURIComponent(raw).split(',')) {
    const v = part.trim().toLowerCase()
    if ((VIBES as readonly string[]).includes(v)) next.add(v as Vibe)
  }
  return next
}

const cookieFixed = (cookieHeader: string | undefined): Set<Vibe> => {
  if (!cookieHeader) return new Set()
  const match = cookieHeader.match(/(?:^|;\s*)tidewell_fixed=([^;]*)/)
  return parseFixed(match?.[1])
}

const queryFixed = (url: string): Set<Vibe> | null => {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
  const params = new URLSearchParams(q)
  const scenario = params.get('scenario')
  if (scenario === 'broken') return new Set()
  if (scenario === 'fixed') return new Set(VIBES)
  if (params.has('fixed')) return parseFixed(params.get('fixed') ?? '')
  return null
}

const resolveFixed = (req: Connect.IncomingMessage): Set<Vibe> => {
  const fromQuery = req.url ? queryFixed(req.url) : null
  if (fromQuery) return fromQuery
  return cookieFixed(req.headers.cookie)
}

const brokenRobots = `User-agent: *
Disallow: /

User-agent: GPTBot
Disallow: /
`

const fixedRobots = `User-agent: *
Allow: /

User-agent: GPTBot
Allow: /
`

const fixedSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://tidewell.example/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://tidewell.example/#shop</loc>
  </url>
</urlset>
`

const fixedLlms = `# Tidewell

> Small-batch ceramics studio (fictional demo for VibeCheck).

## Site
- Home: https://tidewell.example/
- Shop spring glazes, browse glazes, kiln schedule newsletter

## Products
- Harbor mug (Tide Blue)
- Fog bowl, Ash plate, Salt pourer, Moss cup, Ember jar, Bone vase, Iron tray

## Contact
- Studio visits by appointment
`

const fixedMarkdown = `# Tidewell

Mugs that hold the heat.

Tidewell is a fictional small-batch ceramics studio. Stoneware mugs, bowls, and
glazes — thrown, glazed, and fired in-house.

## Spring glazes
- Harbor mug — Tide Blue — $42
- Fog bowl — Harbor Fog — $48
- Ash plate — Kiln Ash — $36
- Salt pourer — Sea Salt — $28
- Moss cup — Moss Green — $32
- Ember jar — Ember — $54
- Bone vase — Bone White — $68
- Iron tray — Iron Speckle — $44

Author: Maya Chen · 2026-03-01
`

const tidewellPlugin = (): Plugin => {
  let root = process.cwd()

  return {
    name: 'tidewell-demo',
    configResolved(config) {
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/'
        const pathOnly = url.split('?')[0] ?? '/'
        const fixed = resolveFixed(req)
        const headFixed =
          fixed.has('clean') || fixed.has('findable') || fixed.has('quotable')
        const lightFixed = fixed.has('light')

        if (pathOnly === '/images/hero-4000.jpg') {
          res.setHeader('Cache-Control', 'no-store')
        }

        if (pathOnly === '/robots.txt') {
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(headFixed && fixed.has('quotable') ? fixedRobots : brokenRobots)
          return
        }

        if (pathOnly === '/sitemap.xml') {
          if (headFixed && fixed.has('findable')) {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8')
            res.end(fixedSitemap)
          } else {
            res.statusCode = 404
            res.end('Not found')
          }
          return
        }

        if (pathOnly === '/llms.txt') {
          if (headFixed && fixed.has('quotable')) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end(fixedLlms)
          } else {
            res.statusCode = 404
            res.end('Not found')
          }
          return
        }

        if (pathOnly === '/api/cart.json') {
          const cartPath = join(root, 'public', 'api', 'cart.json')
          if (existsSync(cartPath)) {
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(readFileSync(cartPath))
            return
          }
        }

        const accept = req.headers.accept ?? ''
        if (
          (pathOnly === '/' || pathOnly === '/index.html' || pathOnly === '/index.fixed.html') &&
          accept.includes('text/markdown') &&
          fixed.has('quotable')
        ) {
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
          res.end(fixedMarkdown)
          return
        }

        const wantsHtml =
          pathOnly === '/' ||
          pathOnly === '/index.html' ||
          pathOnly === '/index.fixed.html'

        if (wantsHtml && req.method === 'GET') {
          const useFixed = headFixed
          const file = useFixed ? 'index.fixed.html' : 'index.html'
          const htmlPath = join(root, file)
          if (!existsSync(htmlPath)) {
            next()
            return
          }
          let html = readFileSync(htmlPath, 'utf8')

          // Moment script only when light vibe is still broken (heavy-library).
          const hasMoment = html.includes('/vendor/moment.min.js')
          if (lightFixed && hasMoment) {
            html = html.replace(
              /\s*<script\s+src="\/vendor\/moment\.min\.js"><\/script>\s*/i,
              '\n',
            )
          } else if (!lightFixed && !hasMoment) {
            html = html.replace(
              '</head>',
              '    <script src="/vendor/moment.min.js"></script>\n  </head>',
            )
          }

          void server.transformIndexHtml(url, html).then((transformed) => {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(transformed)
          }).catch((err: unknown) => {
            next(err instanceof Error ? err : new Error(String(err)))
          })
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tidewellPlugin()],
})
