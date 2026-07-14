import { SITE_URL, GITHUB_URL } from '@/lib/site'

// A full, self-contained markdown summary of the landing page — the same content
// the old middleware inlined, now served through the markdown route so `/`,
// `/index.md`, and `Accept: text/markdown` all return real prose. Kept as a
// function so it stays deterministic and dependency-free.
export const landingMarkdown = (): string => `# VibeCheck

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

    {process.env.NODE_ENV !== 'production' && (
      <VibeCheck beaconUrl="http://127.0.0.1:4200" projectId="my-project" />
    )}

Connect your coding agent over MCP:

    npx -y @wcgw/vibe-check-mcp@0.3.0 hub
    claude mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp@0.3.0 connect

Nine project-scoped MCP tools, an \`llms.txt\`, and a Claude skill ship in the box. Zero runtime deps in core · open source · MIT.

## Links

- Docs: ${SITE_URL}/docs.md
- Quickstart: ${SITE_URL}/docs/quickstart.md
- Fix guides: ${SITE_URL}/fix.md
- Full markdown map for LLMs: ${SITE_URL}/llms.txt
- Whole site as one markdown file: ${SITE_URL}/llms-full.txt
- GitHub: ${GITHUB_URL}
`
