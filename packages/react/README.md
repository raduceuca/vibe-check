# @wcgw/vibe-check

React performance monitoring overlay with AI/vibe-coding issue detection. Drop-in widget that shows live FPS, Web Vitals, memory usage, and detected performance issues.

## Installation

```bash
npm install @wcgw/vibe-check
```

Peer dependencies: `react >= 18`, `react-dom >= 18`

## Quick Start

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

Press **Ctrl+Shift+P** to toggle the overlay. That's it.

## Components

### `<PerfToggle />`

Keyboard-toggled wrapper. Shows/hides the full overlay panel.

```tsx
<PerfToggle
  shortcut="ctrl+shift+p"          // Keyboard shortcut (default)
  vibeCheckProps={{                 // Props passed to VibeCheck
    position: 'bottom-right',
    beaconUrl: 'http://localhost:4200',
  }}
/>
```

### `<VibeCheck />`

The full overlay widget with all panels.

```tsx
<VibeCheck
  enabled={true}                   // Start/stop monitoring
  position="bottom-right"          // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  panels={['fps', 'vitals', 'memory', 'console', 'issues']}
  beaconUrl="http://localhost:4200" // Optional: send data to MCP server
  onIssue={(issue) => {            // Optional: callback for new issues
    console.warn('Issue:', issue.title)
  }}
/>
```

### `<VibeCheckProvider />`

Context provider for sharing an engine instance across components.

```tsx
import { VibeCheckProvider, useVibeCheckEngine } from '@wcgw/vibe-check'

function App() {
  return (
    <VibeCheckProvider>
      <Dashboard />
    </VibeCheckProvider>
  )
}

function Dashboard() {
  const engine = useVibeCheckEngine()
  // Use engine directly
}
```

## Hooks

Use individual hooks for custom UIs:

```tsx
import {
  useVibeCheck,
  useFrameRate,
  useWebVitals,
  useMemory,
  useLongFrames,
  useDetectedIssues,
} from '@wcgw/vibe-check'

function CustomMonitor() {
  const { snapshot } = useVibeCheck()
  const fps = useFrameRate()
  const vitals = useWebVitals()
  const memory = useMemory()
  const issues = useDetectedIssues()

  return <div>FPS: {fps?.fps ?? '--'}</div>
}
```

## AI Agent Integration

Send performance data to an MCP server for AI-assisted debugging:

```tsx
<PerfToggle
  vibeCheckProps={{
    beaconUrl: 'http://localhost:4200',
  }}
/>
```

Then start the MCP server:

```bash
npx @wcgw/vibe-check-mcp
```

Your AI agent can now read live performance data and get fix suggestions.

## Styling

All UI uses inline styles -- no CSS files or external dependencies. The overlay renders at `z-index: 2147483647` and respects `prefers-reduced-motion`.

## License

MIT
