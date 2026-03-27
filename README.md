# vibe-check

Browser performance monitoring designed to catch issues introduced by AI-assisted / vibe coding. Three packages form a pipeline: **core** collects metrics in the browser, **react** renders an overlay widget, and **mcp** exposes the data to AI agents via MCP tools + HTTP.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@wcgw/vibe-check-core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@wcgw/vibe-check-core)](https://www.npmjs.com/package/@wcgw/vibe-check-core) | Framework-agnostic performance monitoring engine |
| [`@wcgw/vibe-check`](./packages/react) | [![npm](https://img.shields.io/npm/v/@wcgw/vibe-check)](https://www.npmjs.com/package/@wcgw/vibe-check) | React overlay widget |
| [`@wcgw/vibe-check-mcp`](./packages/mcp) | [![npm](https://img.shields.io/npm/v/@wcgw/vibe-check-mcp)](https://www.npmjs.com/package/@wcgw/vibe-check-mcp) | MCP server bridging browser metrics to AI agents |

## Quick Start

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

Press **Ctrl+Shift+P** to toggle the performance overlay.

## How It Works

```
Browser (core collectors)  ->  VibeCheckEngine  ->  BeaconClient (POST /api/snapshot)
                                                            |
                                                    MCP Server (httpServer)
                                                            |
                                                    VibeStore (immutable state)
                                                            |
                                                    MCP Tools (AI agent reads)
```

1. **Core** runs collectors in the browser: frame rate, long frames, memory, web vitals, resources, console output
2. **Detectors** analyze snapshots for problems: DOM bloat, duplicate requests, memory leaks, layout thrashing, unoptimized images, console spam, and more
3. **React** renders a toggleable overlay showing live metrics and detected issues
4. **MCP** receives snapshots over HTTP and exposes 6 tools for AI agents to read performance data and get fix suggestions

## AI Agent Integration

Start the MCP server alongside your dev server:

```bash
npx @wcgw/vibe-check-mcp
```

Add the beacon URL to your app:

```tsx
<PerfToggle vibeCheckProps={{ beaconUrl: 'http://localhost:4200' }} />
```

Configure your AI agent (Claude, etc.) to connect to the MCP server on stdio. The agent gets access to tools like `get_performance_snapshot`, `get_detected_issues`, and `get_fix_suggestions`.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint           # TypeScript type-check
pnpm test:coverage  # Coverage report
```

## License

MIT
