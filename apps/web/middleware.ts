import { NextResponse, type NextRequest } from 'next/server'

// ── Markdown content negotiation ─────────────────────────────────────────────
// Every page has a real markdown representation, reachable two ways:
//   1. an explicit `<path>.md` URL (e.g. /fix/cumulative-layout-shift.md), and
//   2. `Accept: text/markdown` on the canonical HTML path.
// Both are rewritten here to the `/md/[[...path]]` route, which returns real
// per-page markdown (not a pointer) with `Content-Type: text/markdown`. This is
// exactly the signal VibeCheck's own aeo audit probes for, dogfooded here.
//
// Browsers never send `text/markdown` on navigation, and Next's RSC / prefetch
// requests use `text/x-component` or `*/*`, so negotiation only fires for clients
// that explicitly opt in — regular HTML/RSC rendering is untouched.

// Map a canonical content path to its `/md/...` markdown target. Returns null for
// paths that have no markdown view (so they render normally).
const toMarkdownTarget = (pathname: string): string | null => {
  const p = pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  // Landing → a plain `home` segment. A literal `index` segment is normalised
  // away by Next, and the optional catch-all's empty root won't prerender.
  if (p === '/') return '/md/home'
  if (p === '/fix') return '/md/fix'
  if (p.startsWith('/fix/')) return `/md${p}`
  if (p === '/docs') return '/md/docs'
  if (p.startsWith('/docs/')) return `/md${p}`
  return null
}

const rewriteTo = (request: NextRequest, target: string): NextResponse => {
  const url = request.nextUrl.clone()
  url.pathname = target
  return NextResponse.rewrite(url)
}

export const middleware = (request: NextRequest): NextResponse => {
  const { pathname } = request.nextUrl

  // 1. Explicit `.md` URLs.
  if (pathname.endsWith('.md')) {
    const base = pathname === '/index.md' ? '/' : pathname.slice(0, -3)
    const target = toMarkdownTarget(base)
    return target ? rewriteTo(request, target) : NextResponse.next()
  }

  // 2. `Accept: text/markdown` on a canonical content path.
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('text/markdown')) {
    const target = toMarkdownTarget(pathname)
    if (target) return rewriteTo(request, target)
  }

  return NextResponse.next()
}

export const config = {
  // Run on content pages and any `.md` URL; skip Next internals, /api, and static
  // assets — including /llms.txt, /llms-full.txt, /robots.txt, /sitemap.xml and
  // /.well-known/mcp.json, which must reach their own routes untouched.
  matcher: [
    '/((?!_next/|api/|.*\\.(?:ico|png|jpg|jpeg|svg|webp|gif|css|js|mjs|map|txt|xml|json|woff2?|ttf|otf|webmanifest)$).*)',
  ],
}
