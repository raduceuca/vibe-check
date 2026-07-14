# Changelog

All notable changes across the `@wcgw/vibe-check`, `@wcgw/vibe-check-core`,
`@wcgw/vibe-check-mcp`, and `@wcgw/vibe-check-protocol` packages. Versions are
kept in lockstep.

## 0.3.0

The MCP workflow is now a durable, project-scoped product rather than a demo.
VibeCheck can hand a concrete browser finding to one owning agent, verify the
repair with fresh browser evidence, reopen regressions, and retain an honest
local impact record across restarts.

### New

- **Durable issue workflow.** Findings move through detected, sent, working,
  verifying, fixed, and regressed phases. Stable page-aware identities preserve
  their timeline across refreshes and hub restarts.
- **Verified project impact.** Each project records unique issues fixed,
  verified fixes, regressions and failed verifications caught, median fix time,
  and conservative before/after measurements for duplicate requests, console
  calls, DOM nodes, transfer size, and main-thread blocking time.
- **Local bragging-rights exports.** Impact is available in the widget, the
  `get_project_impact` MCP tool, HTTP API, and `stats` CLI, with Markdown and
  JSON exports plus a resettable reporting period. The ledger stays local in
  `.vibecheck/state.json`.
- **Complete quick actions.** Every actionable suggestion now has a real
  **Send to agent** action when MCP is available, while copy remains an explicit
  fallback.
- **Configurable placement and durable preferences.** Expanded and collapsed
  positions can be configured independently, and the widget restores its
  collapse state after navigation or refresh.
- **Release-grade onboarding.** `setup`, `register`, and `doctor` provide
  project-aware instructions for Codex, Claude Code, Cursor, and other MCP
  clients.

### Fixed

- **One agent owns one project.** Parallel dev servers are isolated by project,
  watcher conflicts are rejected without stealing the lease, and the widget
  explains how to recover or hand off ownership.
- **Truthful connection colors.** A working agent is green; blue is reserved
  for transitional activity, and offline, waiting, stale, and conflict states
  have distinct instructions.
- **No self-generated duplicate-request warnings.** Beacon, status, workflow,
  and impact traffic to VibeCheck's own local hub is excluded from page request
  findings.
- **Browser-evidence verification.** A fix requires newer clean snapshots;
  stale or worsening evidence cannot create an impact receipt.
- **Idempotent persistence.** Hub restarts and repeated verification cannot
  double-count a fix or measured saving.

### Verification

- Seven packed Playwright scenarios cover real widget dispatch, refresh
  persistence, SEO suggestion delivery, verified fixes, regressions, hub
  restarts, watcher conflicts, handoff, and two-project isolation.
- The public site ships the current widget and a recorded real MCP round trip,
  and the release workflow validates packages before npm publication and the
  Cloudflare production smoke test.

## 0.2.0

The first release carrying the full current product. Everything the demo and
landing page show — the SEO/AEO audits, the agent workflow, the prompts library,
the annotation overlay, light theme, and the "Quiet Instrument" redesign —
shipped after 0.1.3, so `npm install` on 0.1.x delivered a visibly older widget.
This release closes that gap.

### New

- **Real widget-to-agent dispatch.** The Agent panel now has a distinct
  **Send to agent** action backed by `watch_for_issue`; clipboard copies no
  longer masquerade as delivery, and an issue moves to *sent* only after the
  hub confirms it.
- **Shared local hub + stdio bridge roles.** One `vibe-check-mcp hub` process
  receives every browser project while each MCP client spawns `connect`, so
  parallel agent sessions no longer compete to bind port 4200.
- **Project isolation and exclusive watchers.** Snapshots, queues, histories,
  and leases are keyed by stable project ID. One agent watches one project; a
  rejected second watcher is reported without replacing the owner.
- **Nine project-scoped MCP tools.** `list_projects`, `watch_for_issue`, and
  `release_project` join the existing snapshot, issue, suggestion, watch, and
  lifecycle tools. Ambiguous multi-project requests fail closed.
- **Packaged Chromium proof.** The release gate packs the npm artifacts,
  installs two clean Vite consumers, triggers the real DOM-bloat detector,
  clicks the widget, verifies exact MCP delivery and project isolation, rejects
  a conflicting watcher, and proves ownership handoff.
- **`@wcgw/vibe-check-protocol`** — a new package holding the typed evidence
  contract (`VibeSnapshot`, `VibeIssue`, `DetectorName`, …) shared across core
  and mcp instead of each re-declaring the shape.
- **SEO + AEO audits** with scoring, per-check findings, and image alt/size
  checks with on-page flagging.
- **Agent workflow, prompts library, and annotation overlay** surfaced in the
  React widget; **light theme** and the compact **Monitor** view.

### Fixed

- **Truthful agent state.** The widget distinguishes unconfigured, hub offline,
  waiting, connected, working, stale, queue-full, and watcher-conflict states,
  with recovery instructions for each.
- **Honest connection status.** The beacon now delivers snapshots via `fetch`
  and drives the indicator from a real server response (`res.ok`); a queued
  `navigator.sendBeacon` no longer reports a false "connected" when nothing is
  listening. `sendBeacon` remains only as a legacy, status-neutral fallback.
- **No more storage thrash.** Marking a still-live issue sent/resolved no longer
  mismatches the tracking counts, which had caused a permanent 2 Hz
  `localStorage` write + full re-render for the rest of the session.
- **Keyboard focus is visible** on every button and settings toggle (the focus
  ring now wins over the pervasive inline `outline: none`).
- **Audit labels no longer truncate.** The Monitor audits row uses a 2-column
  grid and a shorter vibe label, so "answers"/"search" always fit at 320px.

## 0.1.3

Documentation-only release. No runtime changes — this exists so the new READMEs
ship in the npm tarballs (npm caches the README at publish time).

### Verified and corrected against actual code

- `@wcgw/vibe-check-core`: detector table now includes `heavy-library`; API
  surface lists `getIssues()`, `clearIssues()`, `isRunning()`.
- `@wcgw/vibe-check`: every hook example now passes the `enabled` flag (the
  metric hooks default to `false` and silently return empty stats otherwise);
  `<VibeCheckProvider>` example now passes the required `value={engine}` prop;
  `useDetectedIssues` example shows the explicit-engine pattern.
- `@wcgw/vibe-check-mcp`: rewrote the broken Programmatic Usage block — the
  previous version referenced `updateSnapshot` without importing it and used
  `mcp` before declaration. New version mirrors the real wiring in
  `src/index.ts`. Example `get_performance_snapshot` response now matches the
  full `VibeSnapshot` shape (every field present).

### New content

- **react README**: end-to-end "Complete setup (3 steps)" block with the
  `claude mcp add vibe-check -- npx @wcgw/vibe-check-mcp` one-liner and the
  shared `mcpServers` JSON for everything else; hooks reference table.
- **mcp README**: AI-agent setup table covering Claude Code, Claude Desktop,
  Cursor, Windsurf, Cline, Continue, and Zed; example
  `get_performance_snapshot` response; troubleshooting section (no-snapshot,
  port conflicts, MCP wiring failures, CORS).

## 0.1.2

Performance sweep — vibe-check is a perf monitor, so its own runtime cost is
mission-critical. This release removes the largest sources of allocation and
reflow in the hot paths.

### `@wcgw/vibe-check-core`

- **`FrameRateCollector` no longer allocates per rAF tick.** The previous
  implementation called `RingBuffer.toArray()` on every frame to trim the
  rolling sample window, then again every 500 ms for stat reporting — roughly
  120 throwaway arrays/sec just from the FPS collector. `RingBuffer` now
  exposes `forEach()` and `trimHeadWhile()` for zero-allocation iteration and
  in-place head trimming, and `tick()` uses both.
- **`VibeCheckEngine.getSnapshot()` / `getIssues()` no longer use
  `flatMap([...d.getIssues()])`.** Replaced with a push-loop helper that runs
  on every snapshot interval (500 ms) and every beacon poll.
- **`layoutThrashing` and `duplicateRequests` detectors** now compact their
  rolling-window arrays in place instead of `[...filter(), record]` per event.
- **`heavyLibrary` detector** short-circuits its 30 s rescan once every known
  signature has been reported, and skips entirely when the page is hidden.

### `@wcgw/vibe-check` (React)

- **`AnnotationOverlay`** now uses an `IntersectionObserver` to gate
  `getBoundingClientRect` calls — offscreen annotated elements are no longer
  measured each cycle, eliminating reflows during scroll. IO callbacks drive
  visibility-change updates with rAF coalescing. The safety-net rescan was
  bumped from 2 s → 5 s for elements that load into the DOM after detection,
  and the resize handler is now rAF-throttled.
- **`useVibeCheck`** dropped per-render `JSON.stringify(config)` diffing in
  favor of a tiny `shallowConfigEqual` over a stable ref.
- **`VibeCheck`** hoisted `navTabStyle` to module-level `NAV_TAB_ACTIVE` /
  `NAV_TAB_INACTIVE` constants so descendants get stable style identity.
- **`useIssueStore.sync()`** short-circuits when the live issue id set already
  matches the currently-tracked `new`-status set, so the store no longer
  rebuilds + writes localStorage + re-notifies subscribers every 500 ms when
  nothing has actually changed.
- Added `data-testid="vibe-check-body"` to the panel body div.

### `@wcgw/vibe-check-mcp`

- **`findIssueById`** scans the current snapshot and history arrays in place
  instead of building a concatenated `[...current, ...history]` array on
  every tool call.

### Publish metadata

All three packages now expose `author`, `homepage`, and `bugs` fields, and
`repository.url` uses the standard `git+https://…` form npm expects.
