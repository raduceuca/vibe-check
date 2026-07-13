# Agent Setup and Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Codex, Claude Code, and Cursor setup discoverable inside the widget and add a read-only `doctor` command that identifies the first broken widget-to-agent layer.

**Architecture:** Store client setup values and the project-specific watch instruction in the internal protocol package so the browser and Node bundles share one source. Render those values through an expanded-by-default React connection card and a persistent navigation state dot. Build doctor as a pure report generator over the existing hub client, with separate human/JSON formatters and a thin CLI entry point; keep installed-client acceptance isolated in temporary directories.

**Tech Stack:** TypeScript 5.9 strict mode, React 18/19, Vitest 4, tsup, MCP SDK 1.27, Playwright 1.51, Node.js 20+.

## Global Constraints

- TypeScript strict mode; do not introduce `any`.
- Named arrow-function exports only; do not add default exports.
- Use immutable inputs and outputs.
- Core keeps zero runtime dependencies; the private protocol package is bundled.
- React continues to peer-depend on React 18+ and uses inline styles only.
- Every new helper, React state, MCP command, and compatibility path gets tests.
- The widget and doctor are read-only with respect to agent configuration.
- Supported clients in this pass are Codex, Claude Code, and Cursor.
- One project still has at most one watching agent; one agent still watches at most one project.
- Snapshot freshness becomes a warning after 10,000 ms without a browser update.
- `doctor` exits `0` only for a healthy hub, selected fresh project, and `watching` or `busy` owner; otherwise it exits `1`.

---

## File Structure

- Modify `packages/protocol/src/index.ts` — shared client IDs, setup values, hub command, and watch-instruction generator.
- Modify `packages/protocol/src/__tests__/protocol.test.ts` — exact compatibility fixtures for all three clients.
- Modify `packages/core/src/types.ts` and `packages/core/src/index.ts` — browser-safe re-exports of shared setup helpers.
- Modify `packages/mcp/src/types.ts` and `packages/mcp/src/lib.ts` — Node bundle re-exports of shared setup helpers.
- Modify `packages/mcp/src/hubClient.ts` and its test — read project status without acquiring a lease.
- Create `packages/mcp/src/doctor.ts` and `packages/mcp/src/__tests__/doctor.test.ts` — pure diagnostic report and formatters.
- Modify `packages/mcp/src/cli.ts`, `packages/mcp/src/index.ts`, and CLI tests — doctor arguments and process exit behavior.
- Rewrite `packages/react/src/panels/AgentConnectionStatus.tsx` and its test — actionable setup UI.
- Modify `packages/react/src/panels/SettingsPanel.tsx` — promote connection status above preferences.
- Modify `packages/react/src/panels/nav/BottomNav.tsx`, `packages/react/src/VibeCheck.tsx`, and component tests — persistent connection indicator.
- Create `scripts/test-mcp-clients.mjs` — opt-in installed-client acceptance with temporary configuration.
- Modify root `package.json` — add `test:clients`.
- Modify `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts` — test-first discoverability assertions before dispatch.
- Modify `README.md`, `packages/mcp/README.md`, `packages/react/README.md`, `demo/README.md`, and `skills/vibe-check/SKILL.md` — tutorial, client how-tos, doctor reference, and troubleshooting.

---

### Task 1: Shared Client Setup Contract

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/src/__tests__/protocol.test.ts`
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/mcp/src/types.ts`
- Modify: `packages/mcp/src/lib.ts`

**Interfaces:**
- Produces: `AGENT_CLIENTS`, `AgentClientId`, `AgentClientSetup`, `HUB_START_COMMAND`, `getAgentClientSetup(client)`, and `getWatchInstruction(projectId)`.
- Consumed by: React connection card, doctor next steps, docs consistency checks, and installed-client acceptance.

- [ ] **Step 1: Write failing protocol tests for exact client values**

Add imports and assertions equivalent to:

```ts
expect(AGENT_CLIENTS).toEqual(['codex', 'claude-code', 'cursor'])
expect(getAgentClientSetup('codex')).toMatchObject({
  label: 'Codex',
  format: 'command',
  value: 'codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp connect',
})
expect(getAgentClientSetup('claude-code').value).toBe(
  'claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp connect',
)
expect(JSON.parse(getAgentClientSetup('cursor').value)).toEqual({
  mcpServers: {
    'vibe-check': {
      command: 'npx',
      args: ['-y', '@wcgw/vibe-check-mcp', 'connect'],
    },
  },
})
expect(getWatchInstruction('storefront')).toContain('project_id "storefront"')
expect(HUB_START_COMMAND).toBe('npx -y @wcgw/vibe-check-mcp hub')
```

- [ ] **Step 2: Run the protocol test and verify RED**

Run:

```bash
pnpm --filter @wcgw/vibe-check-protocol test
```

Expected: FAIL because the setup exports do not exist.

- [ ] **Step 3: Implement the immutable shared setup model**

Add this public shape to the protocol package:

```ts
export const AGENT_CLIENTS = ['codex', 'claude-code', 'cursor'] as const
export type AgentClientId = (typeof AGENT_CLIENTS)[number]

export interface AgentClientSetup {
  readonly id: AgentClientId
  readonly label: string
  readonly format: 'command' | 'json'
  readonly destination: string
  readonly value: string
  readonly verifyCommand: string
}

export const HUB_START_COMMAND = 'npx -y @wcgw/vibe-check-mcp hub'

const CLIENT_SETUPS: Readonly<Record<AgentClientId, AgentClientSetup>> = {
  codex: {
    id: 'codex',
    label: 'Codex',
    format: 'command',
    destination: 'Run in the project directory',
    value: 'codex mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp connect',
    verifyCommand: 'codex mcp get vibe-check --json',
  },
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    format: 'command',
    destination: 'Run in the project directory',
    value: 'claude mcp add --scope local vibe-check -- npx -y @wcgw/vibe-check-mcp connect',
    verifyCommand: 'claude mcp get vibe-check',
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    destination: 'Save as .cursor/mcp.json',
    value: JSON.stringify({
      mcpServers: {
        'vibe-check': {
          command: 'npx',
          args: ['-y', '@wcgw/vibe-check-mcp', 'connect'],
        },
      },
    }, null, 2),
    verifyCommand: 'cursor-agent mcp list-tools vibe-check',
  },
}

export const getAgentClientSetup = (client: AgentClientId): AgentClientSetup =>
  CLIENT_SETUPS[client]

export const getWatchInstruction = (projectId: string): string =>
  `Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "${projectId}" and keep waiting for the next issue I send from the widget.`
```

Re-export the values and types from both published packages. Keep the protocol package bundled through the existing tsup configuration.

- [ ] **Step 4: Run protocol, core, and MCP type/tests and verify GREEN**

Run:

```bash
pnpm --filter @wcgw/vibe-check-protocol test
pnpm --filter @wcgw/vibe-check-protocol build
pnpm --filter @wcgw/vibe-check-core lint
pnpm --filter @wcgw/vibe-check-mcp lint
```

Expected: all commands exit `0`; protocol reports 6 or more passing tests.

- [ ] **Step 5: Commit the shared contract**

```bash
git add packages/protocol packages/core/src/index.ts packages/core/src/types.ts packages/mcp/src/types.ts packages/mcp/src/lib.ts
git commit -m "feat: share agent client setup contract"
```

---

### Task 2: Read-Only Doctor Report

**Files:**
- Modify: `packages/mcp/src/hubClient.ts`
- Modify: `packages/mcp/src/__tests__/hubClient.test.ts`
- Create: `packages/mcp/src/doctor.ts`
- Create: `packages/mcp/src/__tests__/doctor.test.ts`
- Modify: `packages/mcp/src/lib.ts`

**Interfaces:**
- Consumes: `HubClient.health/listProjects/getSnapshot/getProjectStatus`, `getAgentClientSetup`, and `getWatchInstruction`.
- Produces: `DoctorReport`, `DoctorCheck`, `runDoctor(options)`, `formatDoctorHuman(report)`, and `formatDoctorJson(report)`.

- [ ] **Step 1: Write a failing hub-client status test**

After posting a real snapshot in `hubClient.test.ts`, add:

```ts
await expect(client.getProjectStatus('project-a')).resolves.toMatchObject({
  projectId: 'project-a',
  state: 'no-agent',
  queueDepth: 0,
})
```

- [ ] **Step 2: Run the hub-client test and verify RED**

```bash
pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/hubClient.test.ts
```

Expected: FAIL because `getProjectStatus` is absent.

- [ ] **Step 3: Add the read-only project-status client method**

Extend `HubClient` with:

```ts
getProjectStatus(projectId: string): Promise<ProjectStatus | null>
```

Implement it with the browser-safe status endpoint and `allowNotFound`:

```ts
async getProjectStatus(projectId): Promise<ProjectStatus | null> {
  return await request<ProjectStatus>(
    `/api/projects/${encodeURIComponent(projectId)}/status`,
    undefined,
    true,
  )
}
```

- [ ] **Step 4: Write failing doctor-domain tests**

Use a typed in-memory `HubClient` fake and fixed `now = 20_000`. Cover these independent cases:

```ts
it('fails with a start-hub step when health is offline')
it('fails closed when several projects exist and none was selected')
it('fails when the requested project does not exist')
it('warns when the selected browser snapshot is older than ten seconds')
it('warns with exact client and watch steps when no agent watches')
it('passes a fresh project with a watching owner')
it('passes a fresh project with a busy owner')
it('reports a recent rejected second watcher without replacing the owner')
it('formats deterministic human and JSON output')
```

For the healthy case assert:

```ts
expect(report.ok).toBe(true)
expect(report.selectedProjectId).toBe('project-a')
expect(report.checks).toContainEqual({
  id: 'watcher',
  level: 'pass',
  message: 'Agent watcher is connected.',
})
```

- [ ] **Step 5: Run doctor tests and verify RED**

```bash
pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/doctor.test.ts
```

Expected: FAIL because `doctor.ts` does not exist.

- [ ] **Step 6: Implement the pure report and formatters**

Define exact report types:

```ts
export type DoctorCheckId = 'runtime' | 'hub' | 'projects' | 'project' | 'snapshot' | 'watcher'
export type DoctorLevel = 'pass' | 'warn' | 'fail'

export interface DoctorCheck {
  readonly id: DoctorCheckId
  readonly level: DoctorLevel
  readonly message: string
}

export interface DoctorReport {
  readonly schemaVersion: 1
  readonly ok: boolean
  readonly hubUrl: string
  readonly generatedAt: number
  readonly selectedProjectId: string | null
  readonly checks: readonly DoctorCheck[]
  readonly projects: readonly ProjectSummary[]
  readonly nextSteps: readonly string[]
}

export interface DoctorOptions {
  readonly hubUrl: string
  readonly projectId?: string
  readonly nodeVersion?: string
  readonly now?: () => number
  readonly client?: HubClient
}
```

`runDoctor` must never acquire a lease. Catch `HubClientError` at the health boundary, preserve a report body, select a project only when explicit or unambiguous, compare `ProjectSummary.lastSeenAt` with `now()`, and use `getProjectStatus` for watcher/queue/conflict details. Set `ok` only when every required check passes and watcher state is `watching` or `busy`.

Human formatting is stable and line-oriented:

```text
VibeCheck doctor — http://127.0.0.1:4200
PASS  Runtime: Node.js 20+ detected.
PASS  Hub: VibeCheck hub 0.2.0 is reachable.
WARN  Watcher: No agent is watching project-a.

Next steps:
1. Configure Codex, Claude Code, or Cursor with the VibeCheck MCP bridge.
2. Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue ...
```

JSON formatting is `JSON.stringify(report, null, 2)` plus a trailing newline.

- [ ] **Step 7: Run MCP tests/type-check and verify GREEN**

```bash
pnpm --filter @wcgw/vibe-check-mcp test
pnpm --filter @wcgw/vibe-check-mcp lint
```

Expected: all MCP tests pass and TypeScript exits `0`.

- [ ] **Step 8: Commit the doctor domain**

```bash
git add packages/mcp/src/hubClient.ts packages/mcp/src/doctor.ts packages/mcp/src/lib.ts packages/mcp/src/__tests__/hubClient.test.ts packages/mcp/src/__tests__/doctor.test.ts
git commit -m "feat(mcp): diagnose hub project and watcher state"
```

---

### Task 3: Doctor CLI Command

**Files:**
- Modify: `packages/mcp/src/cli.ts`
- Modify: `packages/mcp/src/index.ts`
- Modify: `packages/mcp/src/__tests__/cli.test.ts`
- Create: `packages/mcp/src/__tests__/index.test.ts`

**Interfaces:**
- Consumes: `runDoctor`, `formatDoctorHuman`, and `formatDoctorJson`.
- Produces: `CliConfig` doctor variant and `runMain(argv, env, io)` for process-independent testing.

- [ ] **Step 1: Write failing CLI parsing tests**

Add exact cases:

```ts
expect(parseCliConfig(['doctor'], {})).toEqual({
  role: 'doctor',
  hubUrl: 'http://127.0.0.1:4200',
  projectId: undefined,
  json: false,
})
expect(parseCliConfig(['doctor', '--project', 'storefront', '--json'], {
  VIBE_CHECK_HUB_URL: 'http://127.0.0.1:4210',
})).toEqual({
  role: 'doctor',
  hubUrl: 'http://127.0.0.1:4210',
  projectId: 'storefront',
  json: true,
})
expect(() => parseCliConfig(['doctor', '--unknown'], {})).toThrow('Unknown doctor option')
expect(() => parseCliConfig(['doctor', '--project'], {})).toThrow('requires a project ID')
```

- [ ] **Step 2: Run CLI tests and verify RED**

```bash
pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/cli.test.ts
```

Expected: FAIL because doctor is rejected.

- [ ] **Step 3: Implement exact doctor parsing**

Add this variant:

```ts
| {
    readonly role: 'doctor'
    readonly hubUrl: string
    readonly projectId: string | undefined
    readonly json: boolean
  }
```

Parse only `--project <id>` and `--json`, reject duplicate or unknown flags, and update usage to:

```text
Usage: vibe-check-mcp hub | vibe-check-mcp connect | vibe-check-mcp doctor [--project <id>] [--json]
```

- [ ] **Step 4: Write a failing process-independent entry test**

Extract a `runMain` seam and test it with injected output functions:

```ts
const stdout: string[] = []
const code = await runMain(
  ['doctor', '--project', 'project-a', '--json'],
  { VIBE_CHECK_HUB_URL: hubUrl },
  { stdout: (value) => stdout.push(value), stderr: () => undefined },
)
expect(code).toBe(1)
expect(JSON.parse(stdout.join(''))).toMatchObject({
  schemaVersion: 1,
  selectedProjectId: 'project-a',
  ok: false,
})
```

- [ ] **Step 5: Run the entry test and verify RED**

```bash
pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/index.test.ts
```

Expected: FAIL because `runMain` is not exported.

- [ ] **Step 6: Implement the thin doctor entry path**

Move process-independent branching to an exported `runMain`. For doctor:

```ts
const report = await runDoctor({
  hubUrl: config.hubUrl,
  projectId: config.projectId,
})
io.stdout(config.json ? formatDoctorJson(report) : formatDoctorHuman(report))
return report.ok ? 0 : 1
```

Keep hub and connect long-running behavior unchanged. The real entry invokes `runMain`, sets `process.exitCode` for doctor/errors, and retains signal shutdown for hub/connect.

- [ ] **Step 7: Run MCP tests, type-check, and build**

```bash
pnpm --filter @wcgw/vibe-check-mcp test
pnpm --filter @wcgw/vibe-check-mcp lint
pnpm --filter @wcgw/vibe-check-mcp build
node packages/mcp/dist/index.js doctor --json
```

Expected: tests/type/build pass; the final command prints valid JSON and exits `0` only if the currently running default hub has a fresh watched project, otherwise `1` by design.

- [ ] **Step 8: Commit the CLI**

```bash
git add packages/mcp/src/cli.ts packages/mcp/src/index.ts packages/mcp/src/__tests__/cli.test.ts packages/mcp/src/__tests__/index.test.ts
git commit -m "feat(mcp): add doctor command"
```

---

### Task 4: Actionable Widget Setup and Persistent Status

**Files:**
- Modify: `packages/react/src/panels/AgentConnectionStatus.tsx`
- Modify: `packages/react/src/panels/__tests__/AgentConnectionStatus.test.tsx`
- Modify: `packages/react/src/panels/SettingsPanel.tsx`
- Modify: `packages/react/src/panels/nav/BottomNav.tsx`
- Create: `packages/react/src/panels/nav/__tests__/BottomNav.test.tsx`
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: `packages/react/src/__tests__/VibeCheck.test.tsx`
- Modify: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`

**Interfaces:**
- Consumes: `BeaconStatus`, `AGENT_CLIENTS`, `getAgentClientSetup`, `HUB_START_COMMAND`, and `getWatchInstruction`.
- Produces: default-expanded setup UI and `BottomNav.agentConnectionState`.

- [ ] **Step 1: Write failing connection-card tests**

Split the existing broad state test into behavior-focused cases and add:

```ts
it('shows exact Codex setup and project watch instruction while waiting')
it('switches to Claude Code and Cursor setup without losing the project')
it('shows the hub command when offline')
it('shows beaconUrl and projectId integration when unconfigured')
it('collapses setup by default when an agent is connected')
it('lets a connected user reopen setup details')
it('shows ownership-safe recovery after a second-agent conflict')
```

For waiting state assert visible without another click:

```ts
expect(screen.getByText(/codex mcp add vibe-check/)).toBeTruthy()
expect(screen.getByText(/project_id "project-a"/)).toBeTruthy()
expect(screen.getByRole('button', { name: /copy codex setup/i })).toBeTruthy()
expect(screen.getByRole('button', { name: /copy watch instruction/i })).toBeTruthy()
```

Before watcher acquisition in the first packaged round-trip test, also add:

```ts
await expect(page.getByTestId('vibe-check-agent-status')).toContainText('Waiting for')
await expect(page.getByTestId('vibe-check-agent-status')).toContainText(appAUrl)
await expect(page.getByText(/codex mcp add vibe-check/)).toBeVisible()
await expect(page.getByText(new RegExp(`project_id "${escapeForRegExp(appAUrl)}"`))).toBeVisible()
await expect(page.getByRole('button', { name: /copy codex setup/i })).toBeVisible()
```

- [ ] **Step 2: Run the React test and verify RED**

```bash
pnpm --filter @wcgw/vibe-check test -- src/panels/__tests__/AgentConnectionStatus.test.tsx
pnpm test:e2e:mcp
```

Expected: both commands FAIL because the setup selectors and copy controls are absent.

- [ ] **Step 3: Implement the actionable card**

Use local state:

```ts
const [client, setClient] = useState<AgentClientId>('codex')
const [detailsOpen, setDetailsOpen] = useState(state !== 'connected' && state !== 'busy')
const [copied, setCopied] = useState<'hub' | 'setup' | 'watch' | null>(null)
```

Synchronize `detailsOpen` when state changes so non-ready transitions reopen instructions and ready transitions collapse them. Render client buttons with `aria-pressed`, a horizontally scrollable code block, and dedicated copy buttons whose accessible names are `Copy hub command`, `Copy <client> setup`, and `Copy watch instruction`. Use `navigator.clipboard.writeText` with the same textarea fallback already used by `useClipboard`; do not emit sent/delivered state.

Show the project ID as selectable monospace text. For connected/busy states render **Setup details** as an explicit button. Keep every style inline.

- [ ] **Step 4: Run the card tests and verify GREEN**

```bash
pnpm --filter @wcgw/vibe-check test -- src/panels/__tests__/AgentConnectionStatus.test.tsx
```

Expected: all connection-card tests pass.

- [ ] **Step 5: Write failing bottom-navigation state tests**

Add tests with `agentConnectionState="waiting"` and `"connected"`:

```ts
expect(screen.getByRole('tab', { name: /Fix.*waiting for AI agent/i })).toBeTruthy()
expect(screen.getByTestId('vibe-check-agent-connection-dot').getAttribute('data-state')).toBe('waiting')
```

Ensure the existing issue count remains in the same accessible label.

- [ ] **Step 6: Run the navigation test and verify RED**

```bash
pnpm --filter @wcgw/vibe-check test -- src/panels/nav/__tests__/BottomNav.test.tsx
```

Expected: FAIL because `agentConnectionState` is absent.

- [ ] **Step 7: Implement persistent state derivation and nav rendering**

Export one browser display-state helper from the connection component:

```ts
export type AgentDisplayState = 'unconfigured' | 'offline' | 'waiting' | 'connected' | 'busy' | 'stale'
export const getAgentDisplayState = (
  beaconUrl: string | undefined,
  status: BeaconStatus | null | undefined,
): AgentDisplayState => {
  if (!beaconUrl) return 'unconfigured'
  if (!status || status.lastOk === false || status.statusError === 'hub-offline') return 'offline'
  if (status.projectStatus?.state === 'watching') return 'connected'
  if (status.projectStatus?.state === 'busy') return 'busy'
  if (status.projectStatus?.state === 'stale') return 'stale'
  return 'waiting'
}
```

Derive it once in `VibeCheck.tsx` and pass it to `BottomNav`. Render a second 6 px dot on only the Agent/Fix icon using the existing state colors, and append the human state to its title/aria label. Preserve the issue-count dot at a distinct position.

- [ ] **Step 8: Promote status in Settings and verify component integration**

Move the entire **AI Connection / MCP Status** section immediately below the Settings/Configuration heading and above the wording toggle. Update `VibeCheck.test.tsx` to assert the connection state reaches the nav and Agent view.

Run:

```bash
pnpm --filter @wcgw/vibe-check test
pnpm --filter @wcgw/vibe-check lint
pnpm --filter @wcgw/vibe-check size
pnpm test:e2e:mcp
```

Expected: all React tests and both packaged Playwright tests pass, type-check exits `0`, and gzip remains below 45 KB.

- [ ] **Step 9: Commit the widget UX**

```bash
git add packages/react/src e2e/mcp-roundtrip/mcp-roundtrip.spec.ts
git commit -m "feat(react): make agent setup actionable"
```

---

### Task 5: Three-Client Acceptance Harness and Documentation

**Files:**
- Create: `scripts/test-mcp-clients.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `packages/mcp/README.md`
- Modify: `packages/react/README.md`
- Modify: `demo/README.md`
- Modify: `skills/vibe-check/SKILL.md`

**Interfaces:**
- Consumes: published MCP bridge command and vendor CLIs.
- Produces: `pnpm test:clients` with one line of PASS/FAIL/SKIP evidence per client.

- [ ] **Step 1: Add the opt-in command and run it before the script exists**

Add:

```json
"test:clients": "node scripts/test-mcp-clients.mjs"
```

Run:

```bash
pnpm test:clients
```

Expected: FAIL with module-not-found for the missing script.

- [ ] **Step 2: Implement isolated vendor configuration checks**

The script must:

1. create a temporary root with `fs.promises.mkdtemp`;
2. resolve `codex`, `claude`, and `cursor-agent` with a PATH scan;
3. run every vendor command with `execFile`, never `exec`;
4. use a temporary `CODEX_HOME` for Codex;
5. use temporary `HOME`, `CLAUDE_CONFIG_DIR`, and cwd for Claude Code;
6. write `.cursor/mcp.json` below a temporary Cursor cwd;
7. validate command output contains `vibe-check` and the bridge arguments;
8. print exactly `PASS <client> <version>`, `FAIL <client> <reason>`, or
   `SKIP <client> <install/manual step>`;
9. remove the temporary root in `finally`;
10. exit `1` if any installed client fails and `0` when all installed clients
    pass (skips are allowed).

Use these configuration commands:

```js
await run(codex, ['mcp', 'add', 'vibe-check', '--', 'npx', '-y', '@wcgw/vibe-check-mcp', 'connect'], {
  CODEX_HOME: join(root, 'codex-home'),
})
await run(codex, ['mcp', 'get', 'vibe-check', '--json'], codexEnv)

await run(claude, ['mcp', 'add', '--scope', 'local', 'vibe-check', '--', 'npx', '-y', '@wcgw/vibe-check-mcp', 'connect'], claudeEnv)
await run(claude, ['mcp', 'get', 'vibe-check'], claudeEnv)

await writeFile(join(cursorProject, '.cursor/mcp.json'), cursorSetupValue)
await run(cursorAgent, ['mcp', 'list'], cursorEnv)
await run(cursorAgent, ['mcp', 'list-tools', 'vibe-check'], cursorEnv)
```

The script does not run Codex/Claude/Cursor model prompts.

- [ ] **Step 3: Run installed-client acceptance and fix only evidence-backed incompatibilities**

```bash
pnpm test:clients
```

Expected on this development machine: PASS for installed Codex, Claude Code, and Cursor Agent. If a client is not installed, record SKIP with its official verification command; do not report PASS.

- [ ] **Step 4: Rewrite setup documentation by user goal**

Update the main README tutorial so the order is:

1. add widget with stable `projectId`;
2. start hub;
3. open Agent/Fix and choose the client shown in the card;
4. run/save its setup value;
5. restart/open a new agent session;
6. copy the widget's watch instruction;
7. wait for green **Agent connected**;
8. click **Send to agent**.

Add separate Codex, Claude Code, and Cursor how-to sections with the exact shared values. Add the doctor reference with flags, `VIBE_CHECK_HUB_URL`, exit codes, JSON shape, and examples for offline, ambiguous, waiting, and ready states. Explain that `pnpm test:clients` validates configuration without a model call.

Mirror concise task-appropriate versions in package READMEs, the demo README, and the VibeCheck skill. Remove generic claims that untested clients are first-class.

- [ ] **Step 5: Add a docs drift assertion to protocol tests**

Read the five documentation files and assert each first-class client name is present in the main/package docs, while the main and MCP READMEs contain `HUB_START_COMMAND`, every command/JSON bridge fragment, `doctor --project`, and the watch-instruction prefix. This makes future setup changes fail visibly.

- [ ] **Step 6: Run docs, package, and client verification**

```bash
pnpm --filter @wcgw/vibe-check-protocol test
pnpm test:clients
pnpm --filter @wcgw/vibe-check-mcp build
pnpm publish:dry
```

Expected: protocol docs checks pass, installed clients have no FAIL line, MCP builds, and all public packages complete dry-run packing.

- [ ] **Step 7: Commit acceptance and docs**

```bash
git add package.json scripts/test-mcp-clients.mjs README.md packages/mcp/README.md packages/react/README.md demo/README.md skills/vibe-check/SKILL.md packages/protocol/src/__tests__/protocol.test.ts
git commit -m "test: verify Codex Claude and Cursor setup"
```

---

### Task 6: Full Packaged Release Verification

**Files:**
- Verify: all files changed by Tasks 1–5

**Interfaces:**
- Consumes: packed protocol/core/react/MCP packages and real Chromium.
- Produces: packaged proof that the waiting state explains setup before the existing real dispatch.

- [ ] **Step 1: Re-run packaged browser acceptance**

```bash
pnpm test:e2e:mcp
```

Expected: both real round-trip and multi-project isolation tests pass, including the new pre-connection setup assertions.

- [ ] **Step 2: Run the complete release gate from a clean package build**

```bash
pnpm clean
pnpm --filter @wcgw/vibe-check-protocol build
pnpm --filter @wcgw/vibe-check-core build
pnpm --filter @wcgw/vibe-check build
pnpm --filter @wcgw/vibe-check-mcp build
pnpm lint
pnpm test
pnpm build
pnpm --filter @wcgw/vibe-check size
pnpm test:e2e:mcp
pnpm test:clients
pnpm publish:dry
git diff --check
git status --short
```

Expected:

- 0 lint/type errors;
- all unit tests pass;
- all workspace builds pass;
- React gzip is below 45 KB;
- 2 or more Playwright tests pass;
- installed clients contain no FAIL;
- all public package dry-runs pass;
- no whitespace errors;
- only intentional changes remain.

- [ ] **Step 3: Review the branch against the design**

Read `docs/superpowers/specs/2026-07-13-agent-setup-doctor-design.md`, map each acceptance requirement to a passing test or documented manual check, inspect `git diff main...HEAD`, and correct any scope gaps before requesting review or opening a pull request.
