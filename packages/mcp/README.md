# @wcgw/vibe-check-mcp

MCP server that bridges browser performance metrics to AI agents. Receives snapshots from the browser via HTTP and exposes them through 6 MCP tools so any MCP-aware agent can read live perf data and get fix suggestions.

## Installation

```bash
npm install @wcgw/vibe-check-mcp
```

Or run directly without installing:

```bash
npx @wcgw/vibe-check-mcp
```

## How it works

```
Browser (vibe-check widget)  --POST /api/snapshot-->  HTTP server
                                                          |
                                                      VibeStore
                                                          |
AI agent  <--stdio MCP transport--  MCP server  <---------+
```

The server runs two transports simultaneously:
- **HTTP** on port `4200` (configurable via `VIBE_CHECK_PORT`) — receives snapshots from the browser widget and serves an SSE stream
- **stdio** — MCP protocol for AI agent communication

## AI agent setup

Pick the row for your tool. All of them spawn the server via `npx` so you don't need to install anything globally.

| Agent | Setup |
|---|---|
| **Claude Code** | `claude mcp add vibe-check -- npx @wcgw/vibe-check-mcp` |
| **Claude Desktop** | Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (mac) — see JSON below |
| **Cursor** | Settings → MCP → Add new server — paste the JSON below |
| **Windsurf** | `~/.codeium/windsurf/mcp_config.json` — paste the JSON below |
| **Cline** | Cline Settings → MCP Servers — paste the JSON below |
| **Continue** | Add under `mcpServers` in `~/.continue/config.yaml` |
| **Zed** | `settings.json` → `context_servers` — paste the JSON below |

The standard `mcpServers` JSON snippet (works for everything except the Claude Code one-liner above):

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

Then in your app, install the React widget and point it at the same port:

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

<PerfToggle vibeCheckProps={{ beaconUrl: 'http://localhost:4200' }} />
```

## MCP tools

| Tool | Arguments | Description |
|---|---|---|
| `get_performance_snapshot` | — | Current frame rate, Web Vitals, memory, resources, console stats, DOM count, and active issues. |
| `get_detected_issues` | `severity?`, `detector?` | Active (not acknowledged or resolved) issues. Filterable. |
| `get_fix_suggestions` | `issue_id` | Markdown fix guide for one issue: causes, step-by-step fix, code examples. |
| `watch_performance` | `timeout_seconds` (1–300, default 30) | Long-poll for the next snapshot — useful after applying a fix. |
| `acknowledge_issue` | `issue_id` | Hides the issue from `get_detected_issues`. |
| `resolve_issue` | `issue_id` | Marks the issue as fixed. |

### Example: `get_performance_snapshot` response

```json
{
  "timestamp": 1745000000000,
  "frameRate": {
    "fps": 58,
    "avgFrameTime": 17.2,
    "maxFrameTime": 42.1,
    "droppedFrames": 3,
    "smoothness": 95.1
  },
  "longFrames": {
    "count": 1,
    "entries": [],
    "worstFrame": 64
  },
  "webVitals": {
    "lcp": { "value": 1820, "rating": "good" },
    "inp": { "value": 145, "rating": "good" },
    "cls": { "value": 0.04, "rating": "good" }
  },
  "memory": {
    "jsHeapSizeMB": 38,
    "totalHeapSizeMB": 92,
    "usedPct": 41
  },
  "resources": {
    "totalTransferKB": 612,
    "jsTransferKB": 380,
    "cssTransferKB": 42,
    "imageTransferKB": 180,
    "fontTransferKB": 10,
    "resourceCount": 28,
    "largeResources": []
  },
  "console": {
    "logCount": 4,
    "warnCount": 0,
    "errorCount": 0,
    "totalCount": 4
  },
  "domNodeCount": 412,
  "issues": [
    {
      "id": "issue_a91b...",
      "detector": "heavy-library",
      "severity": "warning",
      "title": "Moment.js detected (75KB)",
      "description": "Date library \"Moment.js\" found on page...",
      "evidence": { "library": "Moment.js", "bundleSizeKB": 75 },
      "timestamp": 1745000000000,
      "acknowledged": false,
      "resolved": false
    }
  ]
}
```

When `latestSnapshot` is null (browser hasn't sent anything yet), tools return `{ "error": "No snapshot available yet..." }` instead — agents should handle that as "ask the user to load the page" rather than as a hard failure.

## HTTP endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/snapshot` | POST | Receive a performance snapshot from the browser (1 MiB body cap). |
| `/api/stream` | GET | SSE stream of live snapshots (max 10 concurrent connections). |
| `/api/health` | GET | Health check — returns `{ "status": "ok" }`. |

CORS is wide open (`Access-Control-Allow-Origin: *`) so any local dev server can POST to it.

## Configuration

| Environment variable | Default | Description |
|---|---|---|
| `VIBE_CHECK_PORT` | `4200` | HTTP server port. Anything outside `1–65535` falls back to the default. |

## Programmatic usage

If you want to embed the server in your own Node process instead of running the bin:

```typescript
import {
  createStore,
  updateSnapshot,
  createHttpServer,
  createMcpServer,
  type VibeStore,
} from '@wcgw/vibe-check-mcp'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

let store: VibeStore = createStore()

const httpContext = createHttpServer((snapshot) => {
  store = updateSnapshot(store, snapshot)
})

const mcpContext = createMcpServer(
  () => store,
  (next) => { store = next },
)

// Fan snapshots out to MCP `watch_performance` waiters.
httpContext.onSnapshot((snapshot) => {
  mcpContext.notifySnapshot(snapshot)
})

httpContext.server.listen(4200)

const transport = new StdioServerTransport()
await mcpContext.server.connect(transport)
```

This mirrors what the bundled `npx @wcgw/vibe-check-mcp` bin does internally.

## Troubleshooting

- **"No snapshot available yet"** — the browser widget hasn't POSTed anything. Load the page that has `<PerfToggle />` or `<VibeCheck beaconUrl="..." />` mounted, and make sure the URL matches `http://localhost:4200` (or whatever `VIBE_CHECK_PORT` you set).
- **`EADDRINUSE` on port 4200** — another process owns the port. Set `VIBE_CHECK_PORT=4201` (or anything free) in the env where the MCP server runs, and update `beaconUrl` in your widget to match.
- **Agent reports "tool not found"** — the MCP server didn't connect. Check the agent's MCP logs; for Claude Code: `claude mcp list` should show `vibe-check ✓`. Re-run the `claude mcp add` command if it doesn't.
- **CORS error in the browser** — shouldn't happen (CORS is wide open), but if you've put a proxy in front of the MCP server make sure it forwards `OPTIONS` preflights and the `Access-Control-Allow-*` response headers.

## License

MIT
