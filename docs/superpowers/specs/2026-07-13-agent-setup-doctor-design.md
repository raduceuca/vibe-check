# Agent Setup and Diagnostics Design

**Date:** 2026-07-13

## Problem

VibeCheck can deliver a detected browser issue to one watching agent, but the
widget currently stops at “tell the agent to watch this project.” The exact hub
command, client configuration, restart step, project ID, and agent instruction
live in separate READMEs. A user who reaches **Waiting for your AI agent** has no
in-product path to finish setup.

The packaged end-to-end test proves the stdio MCP bridge with the official SDK,
but does not prove that VibeCheck's instructions match Codex, Claude Code, or
Cursor. Troubleshooting is similarly fragmented: `/api/health` proves only that
the hub process is alive, not that a browser project is publishing or an agent
owns its watcher lease.

## Audience and Outcome

The primary audience is a developer who has added the VibeCheck widget and uses
Codex, Claude Code, or Cursor, but may not know MCP configuration details.

From the widget alone, that developer must be able to:

1. see that agent setup is incomplete from any widget view;
2. open the Agent view and follow exact instructions for their client;
3. copy the correct install/configuration value and a project-specific agent
   instruction;
4. know when to restart or open a new agent session;
5. see the state change to **Agent connected** before clicking **Send to agent**;
6. run one terminal diagnostic that identifies the first broken layer.

This pass does not auto-edit a user's agent configuration, start persistent
background processes, or send a model request without an explicit test command.

## Approaches Considered

### 1. Guided setup card plus a read-only doctor (selected)

Show exact setup in the Agent workflow and add a CLI diagnostic with stable JSON
output. This is explicit, debuggable, safe across clients, and testable without
guessing where each application stores mutable state.

### 2. One-click agent configuration

Let the widget or CLI edit Codex, Claude Code, and Cursor configuration. This is
lower friction but crosses a trust boundary, has client-specific scope rules,
and can silently affect unrelated projects. It is excluded from this pass.

### 3. Documentation links plus a richer health page

Keep the widget compact and send users to external documentation. This leaves
the current discoverability problem intact and makes the critical path depend on
context switching. It is not sufficient.

## Widget Experience

### Persistent discoverability

The bottom Agent/Fix navigation item gains a small connection-state dot that is
independent from its issue-count dot:

- gray: not configured;
- red: hub offline or watcher stale;
- yellow: hub ready, no agent watching;
- green: watching;
- blue: agent busy.

Its accessible label includes both the tab name and connection state. This makes
the state visible from every widget view without adding a global banner.

### Actionable connection card

`AgentConnectionStatus` remains the single truthful rendering of
`BeaconStatus`, but becomes an actionable card:

- **unconfigured:** show the required `beaconUrl`/`projectId` integration shape;
- **offline:** show the exact hub start command and the configured hub URL;
- **waiting:** show client setup and the project-specific watch instruction;
- **stale:** show the reconnect/restart instruction and the same watch prompt;
- **connected/busy:** show a compact success state, project ID, and ownership
  explanation;
- **conflict:** keep the existing warning and explicitly tell the user to remain
  in the owning session or release it before switching.

Non-ready states are expanded by default: no “learn more” click is required to
discover the next step. Ready states collapse the guide to keep issue handling
compact, with a **Setup details** control available for reference.

The Settings view moves **AI Connection / MCP Status** above preference toggles,
so a user opening Settings sees it first. The Agent view continues to put it
above the issue queue.

### Client-specific setup

The card has three compact selectors: **Codex**, **Claude Code**, and **Cursor**.
Each client shows one authoritative local-project setup method:

- Codex:
  `codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp connect`
- Claude Code:
  `claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp connect`
- Cursor: merge a `vibe-check` stdio server into the existing `mcpServers` object
  in `.cursor/mcp.json` without replacing other servers. Its command is `npx` and arguments are
  `[-y, @wcgw/vibe-check-mcp, connect]`.

Every variant then says to restart or open a new agent session and supplies this
copyable, project-specific instruction:

```text
Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with
project_id "<project-id>" and keep waiting for the next issue I send from the
widget.
```

The hub command and agent instruction have separate copy controls with accurate
accessible names. Copying setup text never changes delivery state.

## CLI Doctor

Add these commands:

```bash
npx -y @wcgw/vibe-check-mcp doctor
npx -y @wcgw/vibe-check-mcp doctor --project my-storefront
npx -y @wcgw/vibe-check-mcp doctor --project my-storefront --json
```

`VIBE_CHECK_HUB_URL` selects a non-default hub, matching `connect`.

The doctor is read-only. It uses the existing hub client to check, in order:

1. supported Node.js runtime (20 or newer);
2. hub reachability and VibeCheck identity/version;
3. active browser projects;
4. requested-project existence or project ambiguity;
5. snapshot freshness and page origin;
6. watcher state, lease freshness, queue depth, and recent conflict state.

Human output uses `PASS`, `WARN`, and `FAIL`, prints the selected project ID, and
ends with numbered next steps. When no watcher owns the selected project, those
steps include the hub-appropriate client setup reminder and exact
`watch_for_issue` instruction.

`--json` returns a versioned object suitable for tests and support tooling:

```ts
interface DoctorReport {
  readonly schemaVersion: 1
  readonly ok: boolean
  readonly hubUrl: string
  readonly generatedAt: number
  readonly selectedProjectId: string | null
  readonly checks: readonly DoctorCheck[]
  readonly projects: readonly ProjectSummary[]
  readonly nextSteps: readonly string[]
}

interface DoctorCheck {
  readonly id: 'runtime' | 'hub' | 'projects' | 'project' | 'snapshot' | 'watcher'
  readonly level: 'pass' | 'warn' | 'fail'
  readonly message: string
}
```

`doctor` exits `0` only when the hub, selected project, recent snapshot, and a
healthy `watching` or `busy` owner are present. It exits `1` when action remains;
the JSON body is still printed for expected diagnostic failures.

Snapshot freshness is a warning after 10 seconds without a new browser snapshot.
Multiple projects without `--project` produce an ambiguity failure and list the
available IDs instead of guessing.

## Compatibility Coverage

Compatibility has two layers.

### Deterministic CI coverage

Repository tests validate the exact generated Codex command, Claude Code
command, and Cursor JSON shape. A packed-package compatibility test launches the
stdio bridge described by each setup variant and calls `list_projects`; this
proves all three instructions resolve to the same working transport contract.

The existing Playwright round-trip remains the delivery proof and gains
assertions that a waiting widget exposes the project ID, the selected client's
setup value, and the project-specific watch instruction before the lease is
acquired.

### Installed-client acceptance

Add `pnpm test:clients` as an opt-in local acceptance command. It discovers
installed clients and uses isolated temporary configuration directories or
projects so it never changes the developer's normal MCP configuration:

- Codex: `codex mcp add/get` against a temporary `CODEX_HOME`;
- Claude Code: `claude mcp add/get` in a temporary project and isolated user
  configuration;
- Cursor Agent CLI: a temporary `.cursor/mcp.json`, followed by
  `cursor-agent mcp list` and `list-tools` when that CLI is installed.

The command prints `PASS`, `FAIL`, or `SKIP` per client. A missing vendor CLI is
`SKIP`, not a false pass; the report prints the exact manual verification step.
It does not invoke a language model. A release checklist records the installed
client versions and requires no failures for installed clients.

## Documentation

Documentation is divided by user goal:

- tutorial: README “nothing to first dispatch” flow;
- how-to: one section each for Codex, Claude Code, and Cursor;
- reference: `doctor` flags, JSON schema, exit behavior, and environment;
- troubleshooting: map every widget/doctor state to one next action.

The widget copy and docs use the same setup-data helpers so commands and prompts
cannot drift silently.

## Testing and Acceptance

Implementation follows test-first cycles. Acceptance requires:

1. React tests for default-expanded non-ready states, selectors, exact copy
   values, connected-state collapse, conflict guidance, and nav-state labels;
2. MCP tests for CLI parsing, report construction, formatting, JSON stability,
   exit status, offline hub, ambiguity, missing project, stale snapshot, no
   watcher, healthy watcher, and conflict;
3. compatibility tests for all three client setup definitions;
4. packaged Playwright proof of setup discoverability and real dispatch;
5. full unit tests, type-check, builds, size budget, and publish dry-run;
6. local installed-client acceptance with explicit pass/fail/skip evidence.

## Explicit Non-Goals

- Editing agent configuration from the browser or doctor command.
- Automatically starting or daemonizing the hub.
- Supporting remote/cloud agents that cannot reach the developer's loopback
  interface.
- Replacing the exclusive one-project/one-agent lease model.
- Claiming a client passed when only the generic MCP SDK was exercised.
