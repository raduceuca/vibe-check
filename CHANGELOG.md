# Changelog

All notable changes across the `@wcgw/vibe-check`, `@wcgw/vibe-check-core`,
`@wcgw/vibe-check-mcp`, and `@wcgw/vibe-check-protocol` packages. Versions are
kept in lockstep.

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
