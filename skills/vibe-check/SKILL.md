---
name: vibe-check
description: Monitor browser performance and detect AI/vibe-coding issues. Use when debugging performance problems, reviewing generated code quality, or optimizing web applications. Provides real-time metrics and communicates issues to AI agents via MCP.
user-invocable: true
---

# Vibe Check

Real-time browser performance monitoring that detects issues caused by AI-assisted and vibe coding, then communicates them to AI agents with structured fix suggestions.

## Quick Setup

### 1. Install the widget in your app

```bash
npm install @wcgw/vibe-check -D
```

### 2. Add to your root component

```tsx
import { VibeCheck } from '@wcgw/vibe-check'

// In your app root:
{import.meta.env.DEV && <VibeCheck beaconUrl="http://localhost:4200" />}
```

Or use the keyboard toggle (Ctrl+Shift+P):

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

{import.meta.env.DEV && <PerfToggle vibeCheckProps={{ beaconUrl: 'http://localhost:4200' }} />}
```

### 3. Start the MCP server

```bash
claude mcp add vibe-check -- npx @wcgw/vibe-check-mcp
```

## What It Detects

| Detector | What It Catches | Severity |
|----------|----------------|----------|
| DOM Bloat | >800 DOM nodes (warn), >1500 (error) | warning/error |
| Duplicate Requests | Same URL+method called 2+ times within 2s | warning |
| Console Spam | >20 console calls per 10s window | warning |
| Memory Leak | Heap grows >10% over 30s without GC recovery | warning/error |
| Layout Thrashing | 3+ layout shifts within 500ms without user input | warning |
| Unoptimized Images | Missing lazy loading, dimensions, or oversized | warning/error |
| Long Task Attribution | Scripts causing >50ms frames (LoAF) | warning |
| Resource Bloat | JS/CSS resources >100KB transferred | info |

## MCP Tools

When the MCP server is running, these tools are available to AI agents:

- **`get_performance_snapshot`** — Current FPS, Web Vitals, memory, DOM count, issues
- **`get_detected_issues`** — Filter active issues by severity or detector
- **`get_fix_suggestions`** — Get structured fix guide with code examples for a specific issue
- **`watch_performance`** — Monitor for new issues over N seconds
- **`acknowledge_issue`** — Mark issue as seen
- **`resolve_issue`** — Mark issue as fixed

## Workflow

The typical workflow is:

1. You write or generate code
2. The widget detects performance issues in the browser
3. The MCP server relays issues to your AI agent
4. The agent reads the fix suggestion and applies the fix
5. The agent marks the issue as resolved

Use `get_detected_issues` to see what's wrong, then `get_fix_suggestions` for actionable steps.

## Configuration

```tsx
<VibeCheck
  enabled={true}
  position="bottom-right"
  panels={['fps', 'vitals', 'memory', 'issues']}
  beaconUrl="http://localhost:4200"
  onIssue={(issue) => console.warn('Vibe issue:', issue)}
/>
```

## Individual Hooks

For custom UI or programmatic access:

```tsx
import { useFrameRate, useWebVitals, useMemory, useLongFrames } from '@wcgw/vibe-check'

const fps = useFrameRate(true)
const vitals = useWebVitals(true)
const memory = useMemory(true)
const longFrames = useLongFrames(true)
```
