# @wcgw/vibe-check-mcp

Local hub and MCP bridge for VibeCheck. Browser widgets send project-tagged
snapshots to one long-running hub. Each AI-agent client launches a small stdio
bridge that connects to that hub.

This split matters: starting another agent session no longer tries to bind a
second HTTP server to port 4200, and several dev servers remain isolated by
`projectId`.

## From nothing to a widget-to-agent dispatch

You need Node.js 20+ and an MCP-capable coding agent.

### Fast path: scaffold the project and agent

Run this from an existing React project:

```bash
npx -y @wcgw/vibe-check-mcp@latest setup --agent codex --project my-storefront
```

Supported agents are `codex`, `claude-code`, and `cursor`. The command detects
pnpm, npm, Yarn, or Bun; installs the widget at the same version as the MCP CLI;
creates a named `VibeCheckDevtools` component; and configures the selected MCP
client. Cursor configuration is merged into `.cursor/mcp.json` without removing
other servers.

| Setup option | Meaning |
|---|---|
| `--agent <id>` | Required: `codex`, `claude-code`, or `cursor`. |
| `--project <id>` | Stable routing ID. Defaults to `package.json` name. |
| `--dry-run` | Print install, file, agent, hub, and watch steps without changing anything. |
| `--force` | Replace an existing generated `VibeCheckDevtools.tsx`. Other app files are never rewritten. |

Mount `<VibeCheckDevtools />` once near your React app root, start the hub, and
paste the project-specific watch instruction printed by setup. The generated
component returns `null` in production, so the monitor and local hub connection
cannot ship in the production UI. The detailed manual path below explains every
generated piece.

### 1. Install the React widget

```bash
npm install -D @wcgw/vibe-check
```

Mount it only in development and choose a stable project ID:

```tsx
import { PerfToggle } from '@wcgw/vibe-check'

export const App = () => (
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
```

Without `beaconUrl`, the widget is deliberately local-only: collectors, panels,
annotations, and clipboard prompts work, but it cannot communicate with an agent.

### 2. Start one local hub

Run this in its own terminal and leave it running:

```bash
npx -y @wcgw/vibe-check-mcp@0.2.0 hub
```

Expected output:

```text
[vibe-check] Hub listening on http://127.0.0.1:4200
```

The widget first reports **Waiting for an agent**. That means browser-to-hub
communication works; no agent session owns the project yet.

### 3. Add the MCP bridge to your agent

Choose the same client in the widget setup card and use its exact value.

#### Codex

```bash
codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp@0.2.0 connect
```

Verify with `codex mcp get vibe-check --json`.

#### Claude Code

```bash
claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp@0.2.0 connect
```

Verify with `claude mcp get vibe-check`.

#### Cursor

Merge the `vibe-check` entry into `mcpServers` in `.cursor/mcp.json`. If the file
already contains other MCP servers, keep them alongside this entry:

```json
{
  "vibe-check": {
    "command": "npx",
    "args": [
      "-y",
      "@wcgw/vibe-check-mcp@0.2.0",
      "connect"
    ]
  }
}
```

Create the top-level `mcpServers` object first when starting from an empty file.
Approve the project MCP when Cursor asks. Verify it with
`cursor-agent mcp list-tools vibe-check`.

Restart the agent client after editing its MCP configuration. The bridge expects
the hub at `http://127.0.0.1:4200`; set `VIBE_CHECK_HUB_URL` when the hub uses a
different local port.

### 4. Claim the project and wait

Ask the agent:

```text
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "my-storefront" and keep waiting for the next issue I send from the widget.
```

`watch_for_issue` acquires the project's exclusive watcher lease and waits. The
widget changes to **Agent connected**. While processing a delivered issue it may
show **Agent working**.

### 5. Send a real detected issue

Open the widget's **Agent** tab, expand an issue, and click **Send to agent**.
The pending `watch_for_issue` tool call returns:

- the exact structured issue selected in the browser;
- its project ID and dispatch timestamp; and
- a detector-specific fix suggestion.

The widget moves the issue to *sent* only after the hub confirms the dispatch.
**Copy prompt** is a separate clipboard-only action and never claims delivery.

## Multiple projects and agent sessions

Use one hub for all local dev servers. Give each widget a different stable ID:

```tsx
// localhost:3000
<VibeCheck beaconUrl="http://127.0.0.1:4200" projectId="storefront" />

// localhost:5173
<VibeCheck beaconUrl="http://127.0.0.1:4200" projectId="admin-console" />
```

The hub keeps snapshots, issue histories, dispatch queues, and watcher leases per
project. Agent session A can watch `storefront` while session B watches
`admin-console`; neither can read or consume the other's dispatches.

The ownership rules are intentional:

- one agent session may watch one project at a time;
- one project may have one active agent watcher;
- a second watcher for the same project receives `lease-conflict`;
- the widget keeps showing the original watcher as connected and adds a warning
  that the second agent was rejected;
- leases are heartbeated every 5 seconds, become stale after 10 seconds, and are
  released after 15 seconds without a heartbeat;
- `release_project` releases ownership immediately.

When several projects are active, pass `project_id` to project-scoped tools. If
exactly one is active, it may be omitted. This fail-closed behavior prevents an
agent from silently selecting the wrong dev server.

## MCP tools

| Tool | Main arguments | Purpose |
|---|---|---|
| `list_projects` | — | List active project IDs, page URLs, last-seen times, issue counts, queue depth, and watcher state. |
| `get_performance_snapshot` | `project_id?` | Read the latest snapshot for one project. |
| `get_detected_issues` | `project_id?`, `severity?`, `detector?` | Read active issues for one project. |
| `get_fix_suggestions` | `project_id?`, `issue_id` | Get the detector-specific fix guide for one issue. |
| `watch_performance` | `project_id?`, `timeout_seconds?` | Claim a project and wait for its next snapshot. |
| `watch_for_issue` | `project_id?`, `timeout_seconds?` | Claim a project and wait for a widget button dispatch. |
| `acknowledge_issue` | `project_id?`, `issue_id` | Acknowledge an issue in one project. |
| `resolve_issue` | `project_id?`, `issue_id` | Resolve an issue in one project. |
| `release_project` | — | Release this bridge session's current lease. |

## Browser HTTP API

The public browser routes allow CORS and accept only browser-facing operations:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/health` | GET | Hub readiness and version. |
| `/api/snapshot` | POST | Receive a `ProjectSnapshotEnvelope`. |
| `/api/projects/:projectId/status` | GET | Widget-visible watcher, queue, and conflict state. |
| `/api/projects/:projectId/dispatch` | POST | Queue a selected issue for the owning watcher. |

Bridge-only routes live under `/internal`. Requests with a browser `Origin`
header are rejected there, so a page cannot acquire leases or read another
project through the private API.

## Configuration

| Process | Environment variable | Default | Purpose |
|---|---|---|---|
| `hub` | `VIBE_CHECK_HOST` | `127.0.0.1` | Hub bind address. |
| `hub` | `VIBE_CHECK_PORT` | `4200` | Hub port. |
| `connect` | `VIBE_CHECK_HUB_URL` | `http://127.0.0.1:4200` | Hub used by the stdio bridge. |

For a port override, update all three places together:

```bash
VIBE_CHECK_PORT=4210 npx -y @wcgw/vibe-check-mcp@0.2.0 hub
VIBE_CHECK_HUB_URL=http://127.0.0.1:4210 npx -y @wcgw/vibe-check-mcp@0.2.0 connect
```

```tsx
<VibeCheck beaconUrl="http://127.0.0.1:4210" projectId="my-storefront" />
```

## Programmatic composition

```ts
import {
  createHubClient,
  createHubServer,
  createLeaseManager,
  createMcpServer,
} from '@wcgw/vibe-check-mcp'

const hub = createHubServer({ version: '0.2.0' })
hub.server.listen(4200, '127.0.0.1')

const client = createHubClient('http://127.0.0.1:4200')
const leases = createLeaseManager(client, crypto.randomUUID())
const mcp = createMcpServer(client, leases, '0.2.0')
```

The CLI's `connect` mode also attaches `StdioServerTransport` and releases its
lease on shutdown.

## Doctor command

`doctor` is a read-only check across the full local path. It never acquires or
releases a watcher lease.

```bash
npx -y @wcgw/vibe-check-mcp@0.2.0 doctor
npx -y @wcgw/vibe-check-mcp@0.2.0 doctor --project my-storefront
npx -y @wcgw/vibe-check-mcp@0.2.0 doctor --project my-storefront --json
```

Options and environment:

| Input | Meaning |
|---|---|
| `--project <id>` | Select one project explicitly. Required when several browser projects are active. |
| `--json` | Emit the stable, versioned `DoctorReport` JSON shape. |
| `VIBE_CHECK_HUB_URL` | Override the hub URL used by `doctor` and `connect`. |

The result states are:

- **ready** — exits `0` when the hub is reachable, the selected browser snapshot
  is fresh, and its owner state is `watching` or `busy`;
- **offline** — exits `1`; start `npx -y @wcgw/vibe-check-mcp@0.2.0 hub`;
- **ambiguous** — exits `1`; rerun `doctor --project <id>` with a listed project;
- **missing** — exits `1`; open or reload the requested browser project;
- **stale** — exits `1`; reload a stale browser snapshot or reconnect a stale
  agent watcher;
- **waiting** — exits `1`; configure Codex, Claude Code, or Cursor, restart it,
  and paste the project-specific watch instruction.

JSON output contains `schemaVersion`, `ok`, `hubUrl`, `generatedAt`,
`selectedProjectId`, `checks`, `projects`, and `nextSteps`.

Repository maintainers can run `pnpm test:clients`. It uses temporary Codex,
Claude Code, and Cursor configuration, launches the built bridge through a
temporary hub, and makes no model request.

## Troubleshooting

- **MCP not configured** — no `beaconUrl` reached the widget. Add both
  `beaconUrl` and a stable `projectId`.
- **MCP server offline** — the widget cannot reach the hub. Start `... hub`, check
  `/api/health`, and make sure the hostname and port match exactly.
- **Waiting for an agent** — browser-to-hub works. In an agent session, call
  `watch_for_issue` for the displayed project.
- **Agent disconnected** — the lease heartbeat stopped. Restart/reconnect the MCP
  client and call `watch_for_issue` again after the 15-second expiry.
- **Second agent was rejected** — another healthy session owns that project.
  Continue in the owning session, or call `release_project` there before moving.
- **`project-ambiguous`** — more than one dev server is active. Call
  `list_projects` and pass the intended `project_id`.
- **`EADDRINUSE` on 4200** — a hub may already be running; reuse it. Otherwise
  choose one alternate port and update the hub, bridge, and widget together.
- **Bridge fails during startup** — `connect` intentionally fails if the hub is
  unavailable. Start the hub first, then restart the agent client.

## License

MIT
