import { NextResponse, type NextRequest } from 'next/server'
import { SITE_URL, GITHUB_URL } from '@/lib/site'

// ── Markdown content negotiation ─────────────────────────────────────────────
// When an agent requests a page with `Accept: text/markdown`, hand it a clean
// markdown representation instead of rendered HTML it would have to scrape. This
// is exactly the signal VibeCheck's own aeo audit probes for
// (markdown-negotiation-missing), dogfooded on its own marketing site.
//
// Browsers never send `text/markdown` on navigation, and Next's internal RSC /
// prefetch requests use `text/x-component` or `*/*`, so this only ever fires for
// clients that explicitly opt in — regular rendering is untouched.

// Full, self-contained markdown for the landing page. Kept in the middleware
// (not pulled from MDX/problems) so it stays edge-runtime-safe and lightweight,
// while still being a real summary rather than a stub.
const landingMarkdown = (): string => `# VibeCheck

> A quiet performance instrument for the AI-built frontend. It catches jank, leaks, DOM bloat and layout shift, then hands the evidence to your coding agent over MCP.

**Your agent shipped it. This caught what it broke.**

## The problem

AI agents ship frontends that pass review and look fine in the happy path — then leak memory across route changes, bloat the DOM to 10k nodes, fire the same request eight times, jank on scroll, shift layout as things load, and quietly fail Core Web Vitals and SEO. Nobody is watching, because the "author" was an agent and the human never opened DevTools.

VibeCheck is the observer that was missing: a performance conscience for your coding agent. When something is wrong it doesn't just nag you — it tells the agent, in the agent's own language (MCP), with the exact evidence.

## What it catches

A restrained set of detectors and pass/fail audits, each emitting a machine-readable issue:

- Frame rate / jank and long frames
- Memory leaks across route changes
- DOM bloat (node-count growth)
- Layout shift (CLS)
- Duplicate / repeated network requests
- Core Web Vitals regressions
- Console errors
- **SEO audit** — title, meta description, canonical, headings, Open Graph, alt text, sitemap/robots
- **AEO / AI-readiness audit** — structured data, \`llms.txt\`, markdown negotiation, MCP discovery, AI-crawler access, \`<main>\` landmark, authorship

## From symptom to fix (the round-trip)

The widget captures a snapshot, beacons it to a local MCP server, and your agent reads it — then proposes the diff. Ask your agent: *"What is VibeCheck detecting right now, and how do I fix it?"*

## Install

Drop in the widget:

    import { VibeCheck } from '@wcgw/vibe-check'

    {process.env.NODE_ENV !== 'production' && <VibeCheck />}

Connect your coding agent over MCP:

    claude mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp

Six MCP tools, an \`llms.txt\`, and a Claude skill ship in the box. Zero runtime deps in core · open source · MIT.

## Links

- Docs: ${SITE_URL}/docs
- Quickstart: ${SITE_URL}/docs/quickstart
- Fix guides: ${SITE_URL}/fix
- Full markdown map for LLMs: ${SITE_URL}/llms.txt
- GitHub: ${GITHUB_URL}
`

// Lightweight markdown for docs/fix pages: point agents at the curated,
// per-page llms.txt map rather than re-deriving MDX at the edge.
const pointerMarkdown = (pathname: string): string => `# VibeCheck — \`${pathname}\`

> A markdown view of this page. VibeCheck publishes a curated, per-page markdown map of the whole site.

You requested \`${pathname}\` as markdown. For the full index — every docs page and every fix guide with a one-line description — read:

- Full markdown map: ${SITE_URL}/llms.txt

Elsewhere on the site:

- Home: ${SITE_URL}/
- Docs: ${SITE_URL}/docs
- Fix guides: ${SITE_URL}/fix
- GitHub: ${GITHUB_URL}
`

const markdownFor = (pathname: string): string =>
  pathname === '/' ? landingMarkdown() : pointerMarkdown(pathname)

export const middleware = (request: NextRequest): NextResponse => {
  const accept = request.headers.get('accept') ?? ''
  if (!accept.includes('text/markdown')) {
    return NextResponse.next()
  }

  return new NextResponse(markdownFor(request.nextUrl.pathname), {
    status: 200,
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  })
}

export const config = {
  matcher: ['/', '/docs', '/docs/:path*', '/fix', '/fix/:path*'],
}
