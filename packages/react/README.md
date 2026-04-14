# @wcgw/vibe-check

React performance monitoring overlay with AI/vibe-coding issue detection. Drop-in widget that shows live FPS, Web Vitals, memory usage, and detected performance issues — and pipes them to your AI agent over MCP so it can fix what it broke.

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

Press **Ctrl+Shift+P** to toggle the overlay.

### 2. Wire the MCP server into your AI agent

Pick the line for your agent:

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

Keyboard-toggled wrapper. Renders nothing until the shortcut is pressed.

```tsx
<PerfToggle
  shortcut="ctrl+shift+p"            // Default. Supports ctrl/shift/alt/meta+key
  vibeCheckProps={{
    position: 'bottom-right',
    beaconUrl: 'http://localhost:4200',
  }}
/>
```

### `<VibeCheck />`

The full overlay widget.

```tsx
<VibeCheck
  enabled={true}                                       // Start/stop monitoring
  position="bottom-right"                              // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  panels={['fps', 'vitals', 'memory', 'console', 'issues']}
  beaconUrl="http://localhost:4200"                    // Optional: send data to MCP server
  onIssue={(issue) => console.warn('Issue:', issue.title)}
/>
```

### `<VibeCheckProvider />`

Context provider for sharing an engine instance across components. Note: it's a re-export of `Context.Provider`, so you must pass `value`.

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
import {
  useVibeCheck,
  useFrameRate,
  useWebVitals,
  useMemory,
  useLongFrames,
  useDetectedIssues,
} from '@wcgw/vibe-check'

// Option A: use the engine, read everything from one snapshot
function Monitor() {
  const { snapshot } = useVibeCheck()
  return (
    <div>
      FPS: {snapshot.frameRate.fps} · Issues: {snapshot.issues.length}
    </div>
  )
}

// Option B: use individual collectors (each runs its own collector)
function FpsBadge() {
  const fps = useFrameRate(true)
  return <span>{fps.fps} fps</span>
}

// `useDetectedIssues` reads from a VibeCheckEngine — pass it explicitly
// or use it inside a <VibeCheckProvider value={engine}>.
function IssueList({ engine }: { engine: VibeCheckEngine }) {
  const issues = useDetectedIssues(engine)
  return <ul>{issues.map((i) => <li key={i.id}>{i.title}</li>)}</ul>
}
```

Available hooks:

| Hook | Returns | Notes |
|---|---|---|
| `useVibeCheck(config?, enabled?)` | `{ engine, snapshot }` | Owns the engine. Most consumers want this. |
| `useFrameRate(enabled?)` | `FrameRateStats` | Standalone collector. |
| `useWebVitals(enabled?)` | `WebVitalsStats` | Standalone collector. |
| `useMemory(enabled?)` | `HeapMemory \| null` | Chrome only. |
| `useLongFrames(enabled?)` | `LongFrameStats` | LoAF API. |
| `useDetectedIssues(engine?)` | `readonly VibeIssue[]` | Subscribes to an engine (explicit or via provider). |
| `useIssueStore(liveIssues)` | tracked + status helpers | localStorage-backed issue tracking. |
| `usePreferences()` | `{ prefs, updatePrefs, toggleMode }` | UI mode + annotation visibility. |
| `useClipboard(resetDelayMs?)` | `{ copiedId, copy }` | Used by the prompts panel. |

## AI agent integration

The widget POSTs snapshots to the MCP server's HTTP endpoint (`POST /api/snapshot`). The MCP server then exposes 6 tools to your agent:

- `get_performance_snapshot` — current frame rate, vitals, memory, issues
- `get_detected_issues` — filterable by severity / detector
- `get_fix_suggestions` — markdown fix guide for one issue
- `watch_performance` — long-poll for the next snapshot
- `acknowledge_issue` / `resolve_issue` — close the loop after a fix

See [`@wcgw/vibe-check-mcp`](https://www.npmjs.com/package/@wcgw/vibe-check-mcp) for full setup details across Claude Code, Cursor, Windsurf, Cline, Continue, and Claude Desktop.

## Styling

All UI uses inline styles — no CSS files or external dependencies. The overlay renders at high z-index and respects `prefers-reduced-motion`.

## License

MIT
