# @wcgw/vibe-check

React performance-monitoring overlay with AI/vibe-coding issue detection. A drop-in widget that watches your page in real time — FPS, Web Vitals, memory, SEO/AEO audits, and detected problems — and hands each finding to your AI agent over MCP as a ready-to-paste fix prompt.

All UI is inline-styled (no CSS files), renders at a high z-index, ships a dark and a light theme, and respects `prefers-reduced-motion`.

<!-- TODO: capture ../../docs/screenshots/hero.png (widget expanded on the demo page) -->
<!-- ![vibe-check overlay](../../docs/screenshots/hero.png) -->

## What you get — six tabs

| Tab | What it shows |
|---|---|
| **Monitor** | Live FPS lifeline (avg/worst frame time), Web Vitals (LCP/INP/CLS), memory, console error/warn/log counts, SEO + AEO score chips, and a quick list of active problems. |
| **Agent** | The durable fix queue — every detected problem split across *to fix / in progress / fixed*. Agent pickup, browser verification, and regressions appear in each issue timeline and persist per project. |
| **SEO** | Search-visibility audit — a 0–100 score over the SEO criteria, each failing check expandable with **Send to agent** and **Copy prompt** actions. |
| **AEO** | AI-answer-readiness audit (Answer Engine Optimization) — same shape as SEO, with **Send to agent** on every finding. |
| **Prompts** | A library of proactive prompts to ask your AI agent, each copy-to-clipboard. |
| **Settings** | Wording (dev ⇄ vibe), on-page annotation markers, light theme, FPS-history persistence, independent collapsed/expanded corner placement, MCP connection status, and clear-all. |

On-page **annotation markers** point a badge at the actual offending DOM element (oversized images, heavy libraries, …); click one for an in-place popover with the same **Send to agent**, **Copy prompt**, and resolve actions.

Every detected issue uses this shared action row in the Agent, SEO, AEO, and
annotation views. **Prompts** remains copy-only because it contains proactive
ideas rather than detected issues with evidence to send through MCP.

The widget caches each project's latest workflow locally for an immediate
refresh, while the local MCP hub remains authoritative and persists the full
timeline in that project's `.vibecheck/state.json`. A fix is shown as verified
only after two newer snapshots from the same page no longer contain the issue.

<!-- TODO: capture one screenshot per tab into ../../docs/screenshots/ -->
<!-- ![Monitor](../../docs/screenshots/monitor.png) ![Agent](../../docs/screenshots/agent.png) -->
<!-- ![SEO](../../docs/screenshots/seo.png) ![AEO](../../docs/screenshots/aeo.png) -->
<!-- ![Prompts](../../docs/screenshots/prompts.png) ![Settings](../../docs/screenshots/settings.png) -->

## Installation

```bash
npm install -D @wcgw/vibe-check
```

Peer dependencies: `react >= 18`, `react-dom >= 18`

## Complete setup

### 1. Drop the widget into your app

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

function App() {
  return (
    <>
      <YourApp />
      {import.meta.env.DEV && (
        <PerfToggle vibeCheckProps={{
          beaconUrl: 'http://127.0.0.1:4200',
          projectId: 'my-storefront',
        }} />
      )}
    </>
  )
}
```

On first run the widget shows a small **collapsed pill** in the corner (so you can see it's working). Click it to expand, or press **Alt+Shift+V** to hide/show it.

### 2. Start the local hub

Keep this process running alongside your dev server. One hub supports all your
local projects.

```bash
npx -y @wcgw/vibe-check-mcp@0.2.0 hub
```

### 3. Wire the bridge into your AI agent

Choose Codex, Claude Code, or Cursor in the widget's setup card. For Codex:

```bash
codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp@0.2.0 connect
```

For Claude Code:

```bash
claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp@0.2.0 connect
```

For Cursor, merge this entry into the top-level `mcpServers` object in
`.cursor/mcp.json`; keep any servers already present:

```json
{
  "vibe-check": {
    "command": "npx",
    "args": ["-y", "@wcgw/vibe-check-mcp@0.2.0", "connect"]
  }
}
```

Restart the agent client after changing its MCP configuration. The card keeps
the exact setup and project-specific watch instruction visible until the agent
connects. Run `npx -y @wcgw/vibe-check-mcp@0.2.0 doctor --project my-storefront` if a
step is not turning green.

### 4. Watch, then send

```text
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "my-storefront" and keep waiting for the next issue I send from the widget.
```

The agent calls `list_projects` and `watch_for_issue`. When the widget says
**Agent connected**, expand a detected issue and click **Send to agent**. The
agent receives that issue and a fix suggestion in the pending tool result. You
can send directly from Agent, SEO, AEO, or an on-page annotation; all four use
the same confirmed-delivery behavior.

Only one agent may watch a project at a time. A second watcher is rejected and
the widget warns you, while the original watcher stays connected. Give parallel
dev servers different `projectId` values; they may share the same hub and port.

VibeCheck automatically excludes requests to the configured `beaconUrl` and
its API paths from duplicate-request findings. Other localhost traffic remains
visible, so a real duplicate request to your own app is still reported.

## Components

### `<PerfToggle />`

Keyboard-toggled wrapper. Renders the widget as a collapsed pill on first run; the shortcut hides/shows it.

```tsx
<PerfToggle
  shortcut="alt+shift+v"              // Default — an uncontested combo. Supports ctrl/shift/alt/meta+key
  vibeCheckProps={{
    position: 'bottom-right',
    beaconUrl: 'http://127.0.0.1:4200',
    projectId: 'my-storefront',
  }}
/>
```

> Note: `ctrl+shift+p` (the previous default) collides with the private-window shortcut in Firefox/Edge and can't be intercepted in Firefox — hence `alt+shift+v`.

### `<VibeCheck />`

The full overlay widget.

```tsx
<VibeCheck
  enabled={true}                                       // Start/stop monitoring
  position="bottom-right"                              // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  panels={['fps', 'vitals', 'memory', 'console', 'issues']}
  beaconUrl="http://127.0.0.1:4200"                   // Optional: send data to local hub
  projectId="my-storefront"                           // Stable ID; required when several projects run
  startCollapsed={false}                               // Start as the collapsed pill instead of the open panel
  storageKey="vibe-check:preferences"                  // Optional: per-instance localStorage bucket (multiple embeds)
  engine={undefined}                                   // Optional: drive a provided engine (see "Scripted demos")
  onIssue={(issue) => console.warn('Issue:', issue.title)}
/>
```

`position` is the application fallback. A user-selected corner in Settings is
saved per `projectId` and overrides that fallback. Pass `storageKey` to own the
preference bucket explicitly. `startCollapsed` applies only on first use; after
the user expands or collapses the widget, that choice survives refreshes.

### Scripted demos

Pass an `engine` built with `createScriptedEngine(...)` from `@wcgw/vibe-check-core` to replay a canned, deterministic timeline (identical for every visitor) instead of reading live collectors — useful for landing-page and docs demos.

```tsx
import { VibeCheck } from '@wcgw/vibe-check'
import { createScriptedEngine } from '@wcgw/vibe-check-core'

const engine = createScriptedEngine(myScenario)
<VibeCheck engine={engine} />
```

### `<VibeCheckProvider />`

Context provider for sharing an engine instance across components. It's a re-export of `Context.Provider`, so you must pass `value`.

```tsx
import { useState, useEffect } from 'react'
import { VibeCheckProvider, useVibeCheckEngine } from '@wcgw/vibe-check'
import { VibeCheckEngine } from '@wcgw/vibe-check-core'

function App() {
  const [engine] = useState(() => new VibeCheckEngine())
  useEffect(() => {
    engine.start()
    return () => engine.stop()
  }, [engine])

  return (
    <VibeCheckProvider value={engine}>
      <Dashboard />
    </VibeCheckProvider>
  )
}

function Dashboard() {
  const engine = useVibeCheckEngine()  // Same engine instance
  // ...
}
```

## Hooks

For custom UIs and programmatic access. Each metric hook takes an `enabled` flag (defaults to `false`) and starts its own collector when enabled.

```tsx
import { useVibeCheck, useFrameRate } from '@wcgw/vibe-check'

// Option A: use the engine, read everything from one snapshot
function Monitor() {
  const { snapshot } = useVibeCheck()
  return <div>FPS: {snapshot.frameRate.fps} · Issues: {snapshot.issues.length}</div>
}

// Option B: use individual collectors (each runs its own collector)
function FpsBadge() {
  const fps = useFrameRate(true)
  return <span>{fps.fps} fps</span>
}
```

Available hooks:

| Hook | Returns | Notes |
|---|---|---|
| `useVibeCheck(config?, enabled?, engine?)` | `{ engine, snapshot }` | Owns the engine (or drives a provided one). Most consumers want this. |
| `useFrameRate(enabled?)` | `FrameRateStats` | Standalone collector. |
| `useWebVitals(enabled?)` | `WebVitalsStats` | Standalone collector. |
| `useMemory(enabled?)` | `HeapMemory \| null` | Chrome only. |
| `useLongFrames(enabled?)` | `LongFrameStats` | LoAF API. |
| `useDetectedIssues(engine?)` | `readonly VibeIssue[]` | Subscribes to an engine (explicit or via provider). |
| `useIssueStore(liveIssues)` | tracked + status helpers | localStorage-backed issue tracking. |
| `usePreferences(storageKey?, projectId?, startCollapsed?)` | `{ prefs, updatePrefs, toggleMode }` | Project-scoped UI mode, open/closed state, placement, annotation, theme, and history preferences. |
| `useClipboard(resetDelayMs?)` | `{ copiedId, copy }` | Used by the prompts panel. |

## AI agent integration

The widget POSTs project-tagged snapshots to the local hub and dispatches a
button-selected issue to that project's queue. The stdio bridge exposes 9 tools:

- `list_projects` — active projects and watcher state
- `get_performance_snapshot` — current frame rate, vitals, memory, issues
- `get_detected_issues` — filterable by severity / detector
- `get_fix_suggestions` — markdown fix guide for one issue
- `watch_performance` — claim a project and long-poll for its next snapshot
- `watch_for_issue` — claim a project and wait for a widget dispatch
- `acknowledge_issue` / `resolve_issue` — close the loop after a fix
- `release_project` — explicitly release the current session's project lease

If exactly one project is active, `project_id` is optional. With multiple active
projects the tools require it, preventing data from one dev server from leaking
into another session.

See [`@wcgw/vibe-check-mcp`](https://www.npmjs.com/package/@wcgw/vibe-check-mcp) for the tested Codex, Claude Code, and Cursor setup, doctor output, lease behavior, and port overrides.

## Bundle size

The FPS chart (`liveline`, ~62KB) is lazy-loaded, so the collapsed pill and initial load skip it. `pnpm size` gzips the eager main chunk and checks it against a budget.

## Styling

All UI uses inline styles routed through the `--wcgw-*` design tokens (declared once in an injected stylesheet). No CSS files or external style dependencies. Dark and light themes; respects `prefers-reduced-motion`.

## License

MIT
