# vibe-check

Browser performance and quality monitoring for the age of AI-assisted coding. It
runs in your app, catches the issues vibe-coded sites ship with — janky frames,
DOM bloat, duplicate fetches, memory leaks, unoptimized images, missing SEO/AEO
basics — and hands your AI agent a ready-to-paste fix prompt for each one.

<!-- TODO: screenshot — hero GIF of the widget expanding and flagging issues → docs/screenshots/hero.gif -->

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@wcgw/vibe-check-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@wcgw/vibe-check-core)](https://www.npmjs.com/package/@wcgw/vibe-check-core) | Framework-agnostic monitoring engine (zero deps) |
| [`@wcgw/vibe-check`](./packages/react) | [![npm](https://img.shields.io/npm/v/@wcgw/vibe-check)](https://www.npmjs.com/package/@wcgw/vibe-check) | React overlay widget |
| [`@wcgw/vibe-check-mcp`](./packages/mcp) | [![npm](https://img.shields.io/npm/v/@wcgw/vibe-check-mcp)](https://www.npmjs.com/package/@wcgw/vibe-check-mcp) | MCP server bridging browser metrics to AI agents |

## Framework support

The overlay widget ships **for React 18+ today** (`@wcgw/vibe-check`, which
peer-depends on React). The engine underneath it — `@wcgw/vibe-check-core` — is
framework-agnostic with **zero runtime dependencies**, so you can run the exact
same collectors and detectors headless in any (or no) framework and render your
own UI. Vue/Svelte/vanilla widget adapters are not built yet; the core API below
is the supported path until they are.

## Quick start (React)

```bash
npm install @wcgw/vibe-check
```

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

function App() {
  return (
    <>
      <YourApp />
      <PerfToggle />
    </>
  )
}
```

Press **Ctrl+Shift+P** to toggle the overlay.

## Quick start (headless / any framework)

`@wcgw/vibe-check-core` has no React dependency — drive it directly:

```ts
import { VibeCheckEngine } from '@wcgw/vibe-check-core'

const engine = new VibeCheckEngine({ beaconUrl: 'http://localhost:4200' })
engine.onSnapshot((snapshot) => {
  console.log('fps', snapshot.frameRate.fps)
  for (const issue of snapshot.issues) console.warn(issue.detector, issue.title)
})
engine.start()
// …later: engine.stop()
```

For deterministic demos, `createScriptedEngine(scenario)` implements the same
surface but replays a canned timeline of snapshots and issues.

## The widget, tab by tab

The overlay is six tabs. A **wording toggle** (Settings) switches every label and
fix prompt between *technical* voice and plain-language *vibe* voice, and a light
theme is available.

- **Monitor** — live FPS lifeline, Web Vitals (LCP/INP/CLS), memory, and the SEO/AEO
  audit scores at a glance.
  <!-- TODO: screenshot → docs/screenshots/monitor.png -->
- **Agent** — the detected-issues queue (to fix / sent / fixed). Each row has a
  "copy & send" button that copies a fix prompt tailored to that issue and moves
  it to the sent queue.
  <!-- TODO: screenshot → docs/screenshots/agent.png -->
- **SEO** — a discoverability audit (title, meta description, Open Graph, canonical,
  headings, alt text, sitemap/robots, …) scored as a pass rate.
  <!-- TODO: screenshot → docs/screenshots/seo.png -->
- **AEO** — answer-engine / AI-agent readiness (structured data, `llms.txt`,
  content-without-JS, AI-crawler access, MCP discovery, …).
  <!-- TODO: screenshot → docs/screenshots/aeo.png -->
- **Prompts** — a library of proactive audit prompts (full performance scan, bundle
  diet, memory-leak hunt, image optimization, console cleanup) to copy before any
  issue is even detected.
  <!-- TODO: screenshot → docs/screenshots/prompts.png -->
- **Settings** — beacon/MCP connection status (reflects real delivery), the
  wording toggle, theme, and per-panel visibility.
  <!-- TODO: screenshot → docs/screenshots/settings.png -->

**On-page annotations** — issues with a DOM location can be pinned as markers on
the page itself, so you see *where* a problem lives, not just that it exists.
<!-- TODO: screenshot → docs/screenshots/annotations.png -->

> Screenshots and the hero GIF still need to be captured and committed under
> `docs/screenshots/`.

## How it works

```
Browser (core collectors)  ->  VibeCheckEngine  ->  BeaconClient (POST /api/snapshot)
                                                            |
                                                    MCP Server (httpServer)
                                                            |
                                                    VibeStore (immutable state)
                                                            |
                                                    MCP Tools (AI agent reads)
```

1. **Core** runs collectors in the browser: frame rate, long frames, memory, web
   vitals, resources, console output.
2. **Detectors** analyze snapshots for problems — DOM bloat, duplicate requests,
   memory leaks, layout thrashing, unoptimized/large images, console spam, heavy
   libraries, plus the SEO and AEO audits. (Full reference: [core README](./packages/core#detectors).)
3. **React** renders the six-tab overlay over live metrics, detected issues, and
   audits.
4. **MCP** receives snapshots over HTTP and exposes tools for AI agents to read
   performance data and get fix suggestions.

## AI agent integration

Start the MCP server alongside your dev server:

```bash
npx @wcgw/vibe-check-mcp
# or register it with your agent:
claude mcp add vibe-check -- npx @wcgw/vibe-check-mcp
```

Point the widget at it:

```tsx
<PerfToggle vibeCheckProps={{ beaconUrl: 'http://localhost:4200' }} />
```

The agent gets tools like `get_performance_snapshot`, `get_detected_issues`,
`get_fix_suggestions`, `acknowledge_issue`, and `resolve_issue`.

## Try the demo

A deliberately vibe-coded page that trips every detector:

```bash
cd demo && pnpm dev
```

See [`demo/README.md`](./demo/README.md) for what each section does wrong.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint            # TypeScript type-check
pnpm test:coverage   # Coverage report
pnpm gen:docs        # Regenerate the detector reference in the READMEs + skill
```

## License

MIT — see [LICENSE](./LICENSE).
