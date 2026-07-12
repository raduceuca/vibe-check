# MCP Widget-to-Agent Dispatch Design

**Date:** 2026-07-12
**Status:** Approved for implementation planning

## Goal

Make VibeCheck's agent integration demonstrably real. A new user must be able to
install the packages in a local React app, start the app's dev server, connect one
agent session to that app, detect a real browser issue, click **Send to agent** in
the widget, and receive that exact issue in the watching agent session through
MCP.

The same workflow must remain reliable when several projects and dev servers are
running concurrently. Each project may have one watching agent. Different
projects may each have their own watcher at the same time.

## Non-goals

- Connecting the public marketing-site widget to a visitor's local MCP server.
- Sending code changes directly from the browser.
- Allowing two agents to watch the same project concurrently.
- Persisting telemetry or issue history across hub restarts.
- Supporting a hosted or remotely exposed MCP hub.

## Product truth

The marketing-site widget remains a live collector demo without a `beaconUrl`.
It must be described as local-only and must not imply that its scripted terminal
is a live MCP session.

The installed widget has two distinct actions:

- **Send to agent** performs real delivery through the local VibeCheck hub.
- **Copy prompt** copies text to the clipboard and does not claim delivery.

## Architecture

### Local hub

One VibeCheck hub listens on loopback, normally `127.0.0.1:4200`. It owns:

- browser snapshot ingestion;
- project and browser-instance discovery;
- a separate store and dispatch queue for each project;
- one exclusive agent lease per project;
- watcher heartbeats and lease expiry;
- widget-facing connection status;
- issue dispatch from widget to agent.

The hub is the only process that binds the browser-facing port. Agent sessions
must not each create a competing HTTP receiver.

### Agent bridge

Each stdio MCP process is an agent bridge. It connects to the shared hub and
exposes MCP tools to its parent agent client. The bridge owns a unique agent
session ID and heartbeats any project lease it holds.

The CLI must clearly distinguish the two roles:

```text
vibe-check-mcp hub       # one local browser-facing hub
vibe-check-mcp connect   # stdio MCP bridge spawned by an agent client
```

Clients that support a suitable local HTTP MCP transport may connect directly
in a future release. The v0.2 acceptance contract is stdio through the bridge.

### Project identity

The widget sends a project identity with every request. By default it uses the
browser origin, such as `http://localhost:5173`. Consumers may set an explicit
`projectId` prop when an origin is not a stable or sufficiently specific key.

Each browser runtime also receives an ephemeral `instanceId`. The project ID is
the routing boundary; the instance ID is diagnostic metadata for distinguishing
tabs or reloads. Multiple tabs on the same origin belong to the same project and
share its single agent lease.

The hub exposes active projects with their ID, origin, page title, instance
count, and last-seen timestamp. A project is active while snapshot traffic has
been seen within the previous 10 seconds. When only one project is active, agent
tools may select it automatically. When several projects are active, a tool that
omits `project_id` returns a structured ambiguity response containing the
candidates. It must never guess and route across projects.

## Agent lease

Each project has at most one lease:

```text
unclaimed -> watching -> busy -> watching -> disconnected/unclaimed
```

- Calling `watch_for_issue` acquires the lease when it is unclaimed.
- Repeated calls from the same agent session renew and reuse its lease.
- One agent bridge may hold one project lease at a time.
- A second agent session is rejected without disturbing the existing owner.
- The bridge heartbeats its lease every 5 seconds, independently of individual
  tool calls.
- Closing the stdio connection releases its leases immediately when possible.
- A lease becomes stale after 10 seconds without a heartbeat and expires after
  15 seconds.
- A dispatched issue remains queued for the lease owner while that agent is
  processing the previous tool result.
- Each lease queue holds at most 10 issues; overflow rejects new dispatches
  visibly rather than silently discarding old or new work.

The hub records the latest rejected watch attempt for 30 seconds so the widget
can show a warning. It does not expose sensitive process or filesystem details
to the browser.

## MCP tools

Existing snapshot and suggestion tools become project-scoped. The release adds:

- `list_projects` — active project IDs and safe diagnostic metadata.
- `watch_for_issue` — acquire/reuse the project lease and wait for its next
  dispatched issue.
- `release_project` — voluntarily release the caller's project lease.

`watch_for_issue` accepts `project_id` when multiple projects are active and a
timeout from 1–300 seconds, defaulting to 30. Its successful result includes:

- project ID;
- the validated `VibeIssue`;
- relevant latest-snapshot context;
- the generated fix suggestion/prompt;
- dispatch and receipt timestamps.

The existing `watch_performance` tool continues to mean “wait for the next
snapshot” and is not overloaded with user-dispatch semantics.

## Browser API and widget behavior

The widget continues to POST snapshots periodically. New project-scoped hub
operations provide:

- status for the widget's project;
- immediate issue dispatch;
- safe project registration/heartbeat through ordinary snapshot traffic.

While a hub URL is configured, the widget polls project status every 2 seconds.
Polling pauses while the document is hidden and refreshes immediately when it
becomes visible again.

The browser connection state is derived from real hub responses:

| State | Meaning | Widget behavior |
| --- | --- | --- |
| `unconfigured` | No hub URL supplied | Explain how to configure `beaconUrl`. |
| `hub-offline` | Hub cannot be reached | Show exact hub health/start instructions. |
| `no-agent` | Hub receives snapshots, no lease | Explain how to ask an agent to watch this project. |
| `watching` | One agent owns the lease and is waiting | Green status; enable **Send to agent**. |
| `busy` | Agent owns the lease but is processing/has queued work | Keep delivery available up to the queue limit. |
| `stale` | The previous lease stopped heartbeating | Disable sending until the lease is released/reacquired. |

A recent rejected second-agent attempt is a secondary `lease-conflict` warning,
not a replacement for the primary connection state. A healthy owner therefore
continues to show as `watching` or `busy` while the warning explains that the
second agent was rejected. The warning expires after 30 seconds if no further
conflict occurs.

The issue action uses explicit progress and outcome states: `sending`, `sent`,
`agent-not-watching`, `queue-full`, and `failed`. A failed dispatch never moves
the issue to the browser's “sent” list. Clipboard success and agent-delivery
success remain independent.

## Multi-project behavior

Project A and project B may send snapshots to the same hub. Their stores,
queues, statuses, leases, and tool results are isolated by project ID.

An agent watching A cannot read or receive B unless it releases A and explicitly
selects B. A second agent can watch B concurrently. A second agent attempting A
receives a structured lease-conflict tool result, and widget A receives the
corresponding warning state. Widget B is unaffected.

## Installation experience

The quickstart must describe each process exactly once:

1. Install `@wcgw/vibe-check`.
2. Mount the widget with its hub URL and optional project ID.
3. Start the VibeCheck hub.
4. Configure the agent client to spawn the stdio bridge.
5. Start the application's dev server.
6. Open the application in a browser.
7. Ask the agent to watch VibeCheck for the visible project.
8. Confirm the widget says the agent is watching.
9. Trigger a real issue and click **Send to agent**.
10. Confirm the agent receives and responds to that issue.

Instructions must not start two hub processes and must include health, project
discovery, port-conflict, lease-conflict, and reconnection diagnostics.

## Automated verification

### Fast integration tests

Vitest covers project store isolation, lease acquisition and renewal, heartbeat
expiry, conflicts, bounded queues, dispatch validation, status derivation, and
tool response shapes.

### Packaged end-to-end test

`pnpm test:e2e:mcp` proves the installable artifacts rather than workspace
imports. It will:

1. Build and pack the publishable packages.
2. Create clean temporary Vite/React applications.
3. Install VibeCheck from the tarballs.
4. Start one shared hub on an available loopback port.
5. Start each application's real Vite dev server on a unique port.
6. Launch the apps in real Playwright browser contexts.
7. Wait for real DOM-bloat detection from deliberately large DOM trees.
8. Connect MCP clients through separate stdio bridges.
9. Acquire one project lease per client.
10. Click **Send to agent** in each widget.
11. Assert each pending MCP call receives only its project's exact issue.
12. Attempt a second watcher on one project and assert both the structured MCP
    rejection and widget warning.
13. Disconnect the owner, wait for release, and prove the rejected agent can
    then acquire the project.
14. Verify successful-delivery state in each widget.
15. Tear down browsers, dev servers, bridges, hub, and temporary applications.

The test runs locally and in CI on Node 20. Failures retain Playwright traces,
screenshots, hub logs, bridge logs, dev-server logs, and an MCP transcript.

## Error handling and safety

- All browser-facing services remain loopback-only by default.
- Project IDs, issues, and dispatch bodies are schema-validated and bounded.
- Status endpoints expose only safe diagnostics.
- A non-VibeCheck process occupying the configured hub port produces a specific
  error rather than being treated as a compatible hub.
- Hub or bridge shutdown rejects pending waits and releases resources cleanly.
- Agent errors use MCP error semantics where supported, with structured text
  payloads that remain useful in simpler clients.
- No UI state claims delivery until the hub confirms the dispatch.

## Release readiness

The feature is publishable when the fast tests and packaged E2E test pass, the
quickstart has been followed from a clean directory, package tarballs install
without workspace dependencies, the MCP handshake reports the package version,
and the public scripted examples use real detector names, arguments, and output
shapes or are explicitly labeled illustrative.
