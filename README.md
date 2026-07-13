# vibe-check

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/raduceuca/vibe-check?utm_source=oss&utm_medium=github&utm_campaign=raduceuca%2Fvibe-check&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

Browser performance and quality monitoring for the age of AI-assisted coding. It
runs in your app, catches the issues vibe-coded sites ship with — janky frames,
DOM bloat, duplicate fetches, memory leaks, unoptimized images, missing SEO/AEO
basics — and can dispatch a detected issue directly to the one AI-agent session
watching that project.

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

Press **Alt+Shift+V** to toggle the overlay. This local-only setup needs no MCP
process. Follow [Connect an agent](#connect-an-agent) when you want the widget's
**Send to agent** button to deliver issues into an agent session.

## Quick start (headless / any framework)

`@wcgw/vibe-check-core` has no React dependency — drive it directly:

```ts
import { VibeCheckEngine } from '@wcgw/vibe-check-core'

const engine = new VibeCheckEngine({
  beaconUrl: 'http://127.0.0.1:4200',
  projectId: 'my-project',
})
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
- **Agent** — the detected-issues queue (to fix / sent / fixed). **Copy prompt**
  only copies text. **Send to agent** dispatches the issue to the project's
  connected watcher and moves it to *sent* only after the hub confirms delivery.
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
Browser/project A  ->  local hub (:4200)  <-  MCP bridge  <-  agent session A
Browser/project B  -----------^             MCP bridge  <-  agent session B
        Send to agent -> project queue -> exclusive watcher lease -> watch_for_issue
```

1. **Core** runs collectors in the browser: frame rate, long frames, memory, web
   vitals, resources, console output.
2. **Detectors** analyze snapshots for problems — DOM bloat, duplicate requests,
   memory leaks, layout thrashing, unoptimized/large images, console spam, heavy
   libraries, plus the SEO and AEO audits. (Full reference: [core README](./packages/core#detectors).)
3. **React** renders the six-tab overlay over live metrics, detected issues, and
   audits.
4. The long-running local **hub** receives project-tagged snapshots and dispatches.
   A short-lived stdio **MCP bridge** connects each agent client to that hub.
5. One agent session may lease one project at a time. A project rejects a second
   watcher and reports that conflict in the widget instead of routing ambiguously.

## Connect an agent

Use this order for the first end-to-end connection:

1. Add the widget with a stable `projectId`.
2. Start one local hub and leave it running.
3. Open the widget's **Agent** tab and choose Codex, Claude Code, or Cursor in
   the setup card.
4. Run or save the setup value shown there.
5. Restart the agent client or open a new agent session.
6. Copy the project-specific watch instruction from the widget into that session.
7. Wait until the connection card turns green and says **Agent connected**.
8. Expand an issue and click **Send to agent**.

Start the shared hub:

```bash
npx -y @wcgw/vibe-check-mcp hub
```

Point every local widget at that hub and give each project an explicit stable ID:

```tsx
<PerfToggle vibeCheckProps={{
  beaconUrl: 'http://127.0.0.1:4200',
  projectId: 'my-storefront',
}} />
```

Register the bridge once with the client you use.

### Codex

Run in the project directory:

```bash
codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp connect
```

Verify with `codex mcp get vibe-check --json`.

### Claude Code

```bash
claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp connect
```

Verify with `claude mcp get vibe-check`.

### Cursor

Save this as `.cursor/mcp.json`, then approve the project MCP when Cursor asks:

```json
{
  "mcpServers": {
    "vibe-check": {
      "command": "npx",
      "args": [
        "-y",
        "@wcgw/vibe-check-mcp",
        "connect"
      ]
    }
  }
}
```

Verify with `cursor-agent mcp list-tools vibe-check`.

After restarting or opening a new session, use the instruction copied from the
widget. For this example it is:

```text
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "my-storefront" and keep waiting for the next issue I send from the widget.
```

The pending `watch_for_issue` call returns the exact issue and fix suggestion.

Run only one hub even when several dev servers are active. Project IDs isolate
their snapshots and queues; separate agent sessions can watch separate projects.
The same project cannot have two simultaneous watchers. See the
[MCP package guide](./packages/mcp/README.md) for client configuration, lease
behavior, port overrides, and troubleshooting.

### Diagnose a connection

`doctor` checks Node.js, hub reachability, active projects, browser snapshot
freshness, and watcher ownership without claiming a project:

```bash
npx -y @wcgw/vibe-check-mcp doctor --project my-storefront
npx -y @wcgw/vibe-check-mcp doctor --project my-storefront --json
```

Set `VIBE_CHECK_HUB_URL` when the hub is not on port 4200. Exit code `0` means a
fresh browser project has a `watching` or `busy` owner; offline, ambiguous,
stale, missing, or waiting states exit `1` with exact next steps. The JSON form
returns the versioned `DoctorReport` object for automation.

Maintainers can run `pnpm test:clients` to validate isolated Codex, Claude Code,
and Cursor configuration plus the built bridge transport without making a model
request or editing real user configuration.

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
pnpm test:clients    # Isolated Codex / Claude Code / Cursor MCP acceptance
pnpm lint            # TypeScript type-check
pnpm test:coverage   # Coverage report
pnpm gen:docs        # Regenerate the detector reference in the READMEs + skill
```

## License

MIT — see [LICENSE](./LICENSE).
