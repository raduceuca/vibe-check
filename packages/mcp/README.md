# @wcgw/vibe-check-mcp

MCP server that bridges browser performance metrics to AI agents. Receives snapshots from the browser via HTTP and exposes them through 6 MCP tools.

## Installation

```bash
npm install @wcgw/vibe-check-mcp
```

Or run directly:

```bash
npx @wcgw/vibe-check-mcp
```

## How It Works

```
Browser (vibe-check-core)  --POST /api/snapshot-->  HTTP Server
                                                        |
                                                    VibeStore
                                                        |
AI Agent  <--stdio MCP transport--  MCP Server  <-------+
```

The server runs two transports simultaneously:
- **HTTP** on port 4200 (configurable via `VIBE_CHECK_PORT`) -- receives browser snapshots and serves an SSE stream
- **stdio** -- MCP protocol for AI agent communication

## Usage with Claude

Add to your Claude MCP config:

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

Then in your app:

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

<PerfToggle vibeCheckProps={{ beaconUrl: 'http://localhost:4200' }} />
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_performance_snapshot` | Current FPS, Web Vitals, memory, resources, and DOM stats |
| `get_detected_issues` | Active performance issues with severity and evidence |
| `get_fix_suggestions` | Markdown fix guide for a specific issue (causes, steps, code examples) |
| `watch_performance` | Wait for the next snapshot (long-poll with configurable timeout) |
| `acknowledge_issue` | Mark an issue as acknowledged (hides from `get_detected_issues`) |
| `resolve_issue` | Mark an issue as resolved |

## HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/snapshot` | POST | Receive a performance snapshot from the browser |
| `/api/stream` | GET | SSE stream of live snapshots |
| `/api/health` | GET | Health check |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VIBE_CHECK_PORT` | `4200` | HTTP server port |

## Programmatic Usage

```typescript
import { createStore, createHttpServer, createMcpServer } from '@wcgw/vibe-check-mcp'
import type { VibeStore, VibeSnapshot } from '@wcgw/vibe-check-mcp'

let store = createStore()

const http = createHttpServer((snapshot) => {
  store = updateSnapshot(store, snapshot)
  mcp.notifySnapshot(snapshot)
})

const mcp = createMcpServer(
  () => store,
  (s) => { store = s },
)

http.server.listen(4200)
```

## License

MIT
