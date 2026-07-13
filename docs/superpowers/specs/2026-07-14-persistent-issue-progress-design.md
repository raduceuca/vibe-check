# Persistent Issue Progress and Widget Placement Design

**Date:** 2026-07-14  
**Status:** Approved working design

## Summary

VibeCheck should treat sending an issue to an agent as the start of a visible,
durable workflow rather than moving it into a dead-end “sent” bucket. Each
tracked issue will show whether it was sent, picked up, submitted for
verification, confirmed fixed, or detected again as a regression.

The browser will keep project-scoped display preferences and a read-through
cache for immediate rendering. The shared local hub will own durable issue
workflow state and persist it atomically inside the corresponding project’s
`.vibecheck/` directory. A stable, page-aware issue key will connect detector
occurrences across browser refreshes, hub restarts, and changing ephemeral issue
IDs.

The same project-scoped browser preferences will also remember whether the
widget is collapsed and where its collapsed and expanded forms appear. Settings
will expose an accessible visual corner picker, linked by default but separable
when the user wants different collapsed and expanded positions.

## Goals

- Show useful per-issue progress after a successful agent dispatch.
- Make MCP actions update that progress without manual browser bookkeeping.
- Verify fixes from fresh browser evidence rather than trusting a button or
  agent assertion alone.
- Reopen a previously fixed item when the same stable issue returns and retain
  its occurrence history.
- Preserve issue history across hub restarts in the project’s `.vibecheck/`
  directory.
- Persist an honest project impact ledger for verified fixes, regressions, and
  measurable before/after improvements.
- Preserve collapsed/expanded state and placement across page refreshes.
- Keep multiple projects and development servers isolated behind one shared
  hub.
- Finish with a deterministic, demoable end-to-end regression showcase.

## Non-goals

- A hosted or multi-user issue tracker.
- Synchronizing local history between developers or machines.
- Committing the operational history file to source control.
- Claiming savings that VibeCheck did not measure or cannot attribute.
- Replacing GitHub issues, a task manager, or source-control history.
- Arbitrary drag-and-drop placement; the existing four supported corners remain
  the placement model for this release.

## Current State and Gaps

The React package currently stores `new`, `sent-to-agent`, and `resolved`
records in one global `vibe-check:issues` localStorage bucket. That state is not
scoped by project. Its deduplication key is detector plus title, while each live
issue ID contains a counter and timestamp. The widget therefore cannot identify
the same problem reliably across restarts or title changes.

The hub stores snapshots, queues, leases, acknowledgements, and resolutions in
memory. Restarting the hub loses all of them. Calling `resolve_issue` filters an
ephemeral issue ID, but it does not wait for browser evidence that the problem
has disappeared.

Widget preferences are already persisted, but `collapsed` is component-local
state and the `position` prop applies to both collapsed and expanded forms. The
settings panel has no visual placement control.

## Chosen Architecture

The design uses a hybrid model with a single writer for workflow state:

1. **Browser preferences:** project-scoped localStorage stores display mode,
   theme, annotation settings, collapsed state, and placement choices.
2. **Browser issue cache:** project-scoped localStorage caches the last hub
   workflow response so the panel renders immediately and remains readable
   while the hub is temporarily offline. It is not a competing source of truth.
3. **Hub workflow store:** the local hub owns issue transitions, verification,
   regression detection, impact receipts, and durable history.
4. **Project file:** the hub persists workflow state atomically to
   `.vibecheck/state.json` for the registered project root.

When the hub is available, its workflow version replaces the browser cache. A
temporarily offline widget shows the cached timeline as stale and disables
agent-dependent actions instead of inventing progress that must later be
merged.

## Issue Identity and Page Scope

The existing `VibeIssue.id` remains an occurrence ID. A new shared pure helper
will derive a stable issue key from:

- project ID;
- normalized page key (origin and pathname, excluding hash and query noise);
- detector name; and
- detector-specific identity evidence.

Changing measurements such as counts, durations, transfer sizes, or severity
are excluded from the stable identity. Examples include:

- SEO, AEO, and web essentials: page key plus the failed check;
- duplicate requests: page key, method, and normalized request URL;
- image and resource findings: page key and normalized resource URL;
- heavy libraries: page key and package/library identity; and
- page-wide DOM, memory, layout, and console findings: page key and detector
  subtype where one exists.

The browser snapshot envelope will include the current normalized page URL so
the hub verifies an issue only against later snapshots of the same page. Moving
to another route must not falsely mark a page-specific finding as fixed.

The identity helper will live in the shared zero-dependency protocol/core path
so React and MCP compute the same key without duplicating rules.

## Workflow State Model

Each durable record contains the stable key, page key, latest issue payload,
timestamps, current phase, occurrence count, regression count, and a bounded
event timeline.

The user-facing phases are:

1. **Detected** — currently present and not sent.
2. **Sent** — the hub confirmed dispatch into the owning agent’s queue.
3. **Agent working** — the watching agent dequeued or acknowledged the issue.
4. **Verifying** — the agent or user says the fix is ready for a browser check.
5. **Fixed** — fresh same-page snapshots no longer contain the stable key.
6. **Regressed** — a fixed key has appeared again; it is actionable and its
   occurrence count has increased.

`watch_for_issue` automatically moves a dequeued record to **Agent working**.
The existing `acknowledge_issue` tool remains compatible and has the same
effect. `resolve_issue` changes meaning from “blindly hide this ID” to “ready to
verify.” The widget’s existing fixed action also requests verification rather
than claiming success immediately.

Verification only examines snapshots newer than the request and scoped to the
same page. Two consecutive snapshots without the key confirm **Fixed**. If the
key is still present in the next same-page snapshot, the record returns to
**Agent working** with one `verification-failed` timeline event. Repeated
snapshots do not spam duplicate events.

If a fixed key appears again, the same record becomes **Regressed**, retains its
full timeline, increments its occurrence and regression counts, and returns to
the actionable queue. Sending it again progresses through the same workflow
while retaining a regression badge.

## Project Impact Ledger

The hub stores immutable impact receipts alongside workflow records. Project
totals are derived from receipts and timeline events at read time instead of
incrementing unrelated counters that can drift after retries or restarts.

Exact lifecycle totals include:

- issues detected;
- issues sent to an agent;
- unique issues verified fixed;
- total verified fix cycles, including later regression fixes;
- regressions caught;
- failed verification attempts; and
- median time from dispatch to verified fix.

Each confirmed fix may also create detector-specific measurement receipts. A
receipt contains the stable issue key and occurrence, detector, page key,
baseline and verification snapshot timestamps, before and after values, delta,
unit, and confidence (`measured` or `estimated`). Its deterministic ID prevents
the same verification from being counted twice after a retry or hub restart.

The first supported measurements are:

- duplicate requests eliminated in the detector observation window, using the
  duplicate excess (`count - 1`) before and after verification;
- console calls reduced when comparable console windows are available;
- DOM nodes reduced on the same page;
- transfer KB reduced between comparable same-page snapshots; and
- blocking time reduced between comparable same-page snapshots.

An adapter emits a receipt only when its before and after samples are
comparable. Multiple simultaneous fixes may share a page-level improvement but
must not each claim the full delta. Ambiguous data is either attributed once to
the verification batch or omitted. The UI never turns an absent detector issue
into a fabricated byte, request, or timing value.

“Requests saved” is presented with its scope, for example “4 duplicate requests
removed per observed page load,” rather than extrapolating an unbounded lifetime
number. An optional estimated cumulative value may multiply that verified delta
only by page loads VibeCheck actually observed after the fix and is labeled
**estimated**.

Clearing fixed rows does not delete impact receipts. Resetting project impact is
a separate destructive action with confirmation.

## Agent Panel Experience

The current “sent” tab becomes **in progress** and contains records in Sent,
Agent working, and Verifying phases. The other tabs remain **to fix** and
**fixed**. A regressed record returns to **to fix** and is sorted ahead of new
findings of equal severity.

Every expanded issue row shows:

- a compact current-state badge;
- a short timeline with timestamps for dispatch, pickup, verification, fix, and
  regression events;
- “occurrence N” and “regressed N times” when applicable; and
- the existing shared copy, send, and verification actions appropriate for its
  current phase.

Connection colors remain semantic: connected and Agent working are both green,
waiting is yellow, and offline or stale is red. Blue remains reserved for
informational findings and navigation indicators, not healthy agent activity.

A compact **VibeCheck impact** card appears in the Agent view and the monitor
overview. It prioritizes verified fixes and regressions caught, then shows only
the measurement totals the project has actually earned, such as duplicate
requests removed or transfer KB reduced. Each measurement has a short scope or
confidence tooltip.

The card includes **Copy impact summary** for a concise, shareable statement,
for example: “VibeCheck caught 3 regressions and helped verify 12 fixes,
including 4 duplicate requests removed per observed page load.” The copy uses
“caught,” “verified,” and “helped” so it does not falsely claim that VibeCheck
wrote the fixes itself.

Settings provides JSON and Markdown export plus a separately confirmed
**Reset impact stats** action. Export does not include local filesystem paths,
agent session identifiers, or raw page content.

Fixed records remain inspectable. Clearing the fixed view removes them from the
browser presentation but does not erase the durable regression baseline. A
separate explicit “forget history” operation would be required to destroy that
baseline and is outside this release.

When workflow persistence is not configured, the panel explains that progress
is browser-only and links the user to the exact setup command. When the hub is
temporarily offline, the cached timeline is labeled “last known” rather than
silently appearing current.

## Collapsed State and Visual Placement Settings

`VibeCheckPreferences` gains:

- `collapsed: boolean`;
- `positionsLinked: boolean`;
- `collapsedPosition: Position | null`; and
- `expandedPosition: Position | null`.

For a project with no saved preference, `startCollapsed` remains the initial
default. After the first user toggle, the saved `collapsed` value wins across
refreshes. Older stored preferences migrate by filling the new fields from
defaults.

The effective placement is the saved state-specific override when present,
otherwise the existing `position` prop. This preserves existing application
defaults until a user chooses a placement. Settings provides “Reset to app
default,” which clears both overrides.

The settings UI uses a small visual viewport with four corner targets. It is an
accessible radio group with keyboard navigation and visible selected/focus
states, not a canvas-only interaction.

- **Use one position for both** is on by default and shows one picker. Selecting
  a corner updates both saved overrides.
- Turning it off shows two labeled pickers, **Collapsed** and **Expanded**.
- Position changes are visible immediately without closing settings or
  refreshing.
- Changing between collapsed and expanded states applies the corresponding
  corner without losing the saved open/closed state.

The default localStorage preference key becomes project-scoped when the caller
does not provide `storageKey`. An explicit `storageKey` remains authoritative
for backward compatibility. Issue-cache keys are always project-scoped.

## Project Registration and Files

Browsers must not send local filesystem paths. The setup command already knows
the project root, so it will create and register the mapping safely:

```text
.vibecheck/
  config.json   # schema version + stable project ID; safe to commit
  state.json    # workflow history + impact receipts; ignored by git
```

Setup also updates a user-local registry mapping project ID to the absolute
project root. The shared hub reads that registry and writes only beneath the
registered root. Manual integrations receive an equivalent explicit register
command. If a project is publishing snapshots without a registered root, the
hub continues in memory and the widget gives a precise persistence setup
instruction.

Two project roots may not claim the same project ID. Registration rejects that
collision and tells the user to assign a unique `projectId`. One repository may
register multiple IDs when it intentionally runs multiple apps; their records
remain separate inside the versioned state file.

Setup adds `.vibecheck/state.json` and temporary atomic-write files to
`.gitignore`, but keeps `.vibecheck/config.json` commit-able. State writes use a
temporary sibling file plus rename. The hub writes only on workflow changes and
debounces observational timestamp updates so normal snapshot traffic does not
write every polling interval.

On startup, invalid or newer-schema state is preserved as a timestamped backup
and reported as a persistence warning; it must not prevent the hub from serving
new snapshots.

## API and Protocol Changes

Browser-facing additions:

- snapshot envelopes include the normalized page URL;
- a project workflow endpoint returns versioned records and the derived project
  impact summary for the widget cache; and
- a project issue verification endpoint lets the widget request evidence-based
  verification.

Existing dispatch responses remain compatible. A successful dispatch creates
the Sent transition before responding.

Bridge-facing changes:

- dequeuing an issue records Agent working;
- acknowledge records Agent working idempotently;
- resolve requests verification; and
- issue lookup accepts occurrence IDs while resolving them to their durable
  stable record.

MCP gains `get_project_impact` so a watching agent can report exact project
results without reading files directly. The CLI gains
`stats --project <id> [--json|--markdown]` for local inspection and sharing.

No local path or registry data is exposed through browser-facing endpoints.

## Limits and Retention

The hub keeps at most 200 issue records per registered project, while never
evicting an active or fixed regression baseline in favor of an older transient
record. Each record keeps at most 50 timeline events. Compaction preserves
first-seen, last-seen, occurrence, regression, and latest phase timestamps.

## Testing Strategy

Unit tests will cover:

- detector-specific stable keys and exclusion of changing measurements;
- page/query normalization;
- every valid and invalid workflow transition;
- idempotent dequeue, acknowledge, and verify calls;
- two-snapshot fix confirmation and failed verification;
- regression reopening and occurrence counts;
- idempotent impact receipts and derived lifecycle totals;
- measured versus estimated impact adapters and ambiguous batch attribution;
- project-scoped preference and cache migrations;
- collapsed-state restoration and `startCollapsed` fallback;
- linked and independent visual position selection;
- atomic persistence, restart recovery, corrupt-file backup, and write
  debouncing; and
- registration collisions and multiple-project isolation.

Component tests will verify accessible picker semantics, immediate movement,
the in-progress timeline, last-known/offline labels, and regression badges.

The packed end-to-end test will use temporary project roots and the real built
hub/bridge packages. It will:

1. register and start two isolated projects against one hub;
2. dispatch an issue from the widget;
3. observe Agent working after the MCP bridge receives it;
4. request verification through MCP;
5. publish same-page snapshots without the issue until it becomes Fixed;
6. restart the hub and prove the fixed record survives;
7. publish the same stable issue under a new occurrence ID and prove it becomes
   Regressed only in the correct project; and
8. verify that project impact survives the restart without double counting,
   exposes an honest copyable summary, and stays isolated from the second
   project; and
9. refresh the browser and prove collapsed state and both placement choices
   survive.

## Showcase Handoff

The completed batch must leave a running local showcase with a documented URL
and a deterministic control path. The user will be able to send a finding,
watch its timeline advance as the real MCP bridge receives and resolves it,
confirm the browser-verified fix, refresh without losing widget state or
placement, inspect and copy the persisted impact summary, and deliberately
replay the finding to see the regression reopen and its totals update once.
