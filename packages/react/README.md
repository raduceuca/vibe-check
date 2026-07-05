# @wcgw/vibe-check

React performance-monitoring overlay with AI/vibe-coding issue detection. A drop-in widget that watches your page in real time — FPS, Web Vitals, memory, SEO/AEO audits, and detected problems — and hands each finding to your AI agent over MCP as a ready-to-paste fix prompt.

All UI is inline-styled (no CSS files), renders at a high z-index, ships a dark and a light theme, and respects `prefers-reduced-motion`.

<!-- TODO: capture ../../docs/screenshots/hero.png (widget expanded on the demo page) -->
<!-- ![vibe-check overlay](../../docs/screenshots/hero.png) -->

## What you get — six tabs

| Tab | What it shows |
|---|---|
| **Monitor** | Live FPS lifeline (avg/worst frame time), Web Vitals (LCP/INP/CLS), memory, console error/warn/log counts, SEO + AEO score chips, and a quick list of active problems. |
| **Agent** | The fix queue — every detected problem with a copy-for-your-AI prompt, split across *to fix / sent / fixed*. "copy & send" copies the prompt and moves the item to *sent*. |
| **SEO** | Search-visibility audit — a 0–100 score over the SEO criteria, each failing check expandable with a fix prompt. |
| **AEO** | AI-answer-readiness audit (Answer Engine Optimization) — same shape as SEO, scored over the AEO criteria. |
| **Prompts** | A library of proactive prompts to ask your AI agent, each copy-to-clipboard. |
| **Settings** | Wording (dev ⇄ vibe), on-page annotation markers, light theme, FPS-history persistence, MCP connection status, and clear-all. |

On-page **annotation markers** point a badge at the actual offending DOM element (oversized images, heavy libraries, …); click one for an in-place popover with the same copy-for-AI prompts.

<!-- TODO: capture one screenshot per tab into ../../docs/screenshots/ -->
<!-- ![Monitor](../../docs/screenshots/monitor.png) ![Agent](../../docs/screenshots/agent.png) -->
<!-- ![SEO](../../docs/screenshots/seo.png) ![AEO](../../docs/screenshots/aeo.png) -->
<!-- ![Prompts](../../docs/screenshots/prompts.png) ![Settings](../../docs/screenshots/settings.png) -->

## Installation

```bash
npm install -D @wcgw/vibe-check
```

Peer dependencies: `react >= 18`, `react-dom >= 18`

## Complete setup (3 steps)

### 1. Drop the widget into your app

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

function App() {
  return (
    <>
      <YourApp />
      {import.meta.env.DEV && (
        <PerfToggle vibeCheckProps={{ beaconUrl: 'http://localhost:4200' }} />
      )}
    </>
  )
}
```

On first run the widget shows a small **collapsed pill** in the corner (so you can see it's working). Click it to expand, or press **Alt+Shift+V** to hide/show it.

### 2. Wire the MCP server into your AI agent

```bash
# Claude Code
claude mcp add vibe-check -- npx @wcgw/vibe-check-mcp
```

Or add it to the agent's `mcpServers` config (Cursor, Windsurf, Cline, Continue, Claude Desktop, Zed):

```json
{
  "mcpServers": {
    "vibe-check": {
      "command": "npx",
      "args": ["@wcgw/vibe-check-mcp"]
    }
  }
}
```

### 3. Start your dev server and ask your agent

```
What's vibe-check seeing right now? Anything we should fix?
```

Your agent will call `get_performance_snapshot`, `get_detected_issues`, and `get_fix_suggestions` and walk you through the fixes.

## Components

### `<PerfToggle />`

Keyboard-toggled wrapper. Renders the widget as a collapsed pill on first run; the shortcut hides/shows it.

```tsx
<PerfToggle
  shortcut="alt+shift+v"              // Default — an uncontested combo. Supports ctrl/shift/alt/meta+key
  vibeCheckProps={{
    position: 'bottom-right',
    beaconUrl: 'http://localhost:4200',
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
  beaconUrl="http://localhost:4200"                    // Optional: send data to MCP server
  startCollapsed={false}                               // Start as the collapsed pill instead of the open panel
  storageKey="vibe-check:preferences"                  // Optional: per-instance localStorage bucket (multiple embeds)
  engine={undefined}                                   // Optional: drive a provided engine (see "Scripted demos")
  onIssue={(issue) => console.warn('Issue:', issue.title)}
/>
```

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
| `usePreferences(storageKey?)` | `{ prefs, updatePrefs, toggleMode }` | UI mode + annotation/theme/history prefs. |
| `useClipboard(resetDelayMs?)` | `{ copiedId, copy }` | Used by the prompts panel. |

## AI agent integration

The widget POSTs snapshots to the MCP server's HTTP endpoint (`POST /api/snapshot`). The MCP server then exposes 6 tools to your agent:

- `get_performance_snapshot` — current frame rate, vitals, memory, issues
- `get_detected_issues` — filterable by severity / detector
- `get_fix_suggestions` — markdown fix guide for one issue
- `watch_performance` — long-poll for the next snapshot
- `acknowledge_issue` / `resolve_issue` — close the loop after a fix

See [`@wcgw/vibe-check-mcp`](https://www.npmjs.com/package/@wcgw/vibe-check-mcp) for full setup across Claude Code, Cursor, Windsurf, Cline, Continue, and Claude Desktop.

## Bundle size

The FPS chart (`liveline`, ~62KB) is lazy-loaded, so the collapsed pill and initial load skip it. `pnpm size` gzips the eager main chunk and checks it against a budget.

## Styling

All UI uses inline styles routed through the `--wcgw-*` design tokens (declared once in an injected stylesheet). No CSS files or external style dependencies. Dark and light themes; respects `prefers-reduced-motion`.

## License

MIT
