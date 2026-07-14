# Universal Agent Actions and MCP Traffic Filtering Design

**Date:** 2026-07-14
**Status:** Approved for implementation planning

## Goal

Every detector-backed fix suggestion in the VibeCheck widget must offer the
same real **Send to agent** action. Users should not have to switch to the Agent
tab or copy a prompt when a watcher is already connected.

VibeCheck must also exclude its own MCP hub traffic from duplicate-request
detection. The widget's periodic snapshot and status calls are instrumentation,
not application behavior, and must not create issues that VibeCheck then reports
to itself.

## Scope

The shared issue actions apply to:

- issue rows in the Agent tab;
- SEO findings;
- AEO findings; and
- issue suggestions in annotation popovers.

The prompt library remains clipboard-only. Those prompts are general guidance,
not detected `VibeIssue` objects, so the existing MCP issue-dispatch contract
cannot route them without inventing a second queue payload.

The traffic filter applies only to the configured `beaconUrl` URL tree. It does
not ignore localhost generally, other ports, or application API calls on the
page origin.

## Approaches considered

### Shared issue-action component — selected

Extract the existing Agent-tab delivery logic into one internal component and
render it from every detector-backed suggestion surface. This keeps delivery
state, labels, failure handling, accessibility, and sent-state transitions
consistent.

### Duplicate delivery logic in each panel

Adding bespoke buttons to AuditPanel and AnnotationOverlay is initially
smaller, but it creates three copies of the connection-state and error mapping.
Those copies would drift as MCP result codes evolve.

### Redirect every action to the Agent tab

A link could switch tabs and ask the user to find and expand the issue again.
This avoids new props, but it is not the requested quick action and adds an
unnecessary second interaction.

## Shared issue actions

Create an internal `IssueActions` component with these inputs:

- the tracked issue;
- the current MCP beacon status;
- the engine-backed dispatch callback;
- callbacks for marking the issue sent or resolved; and
- optional presentation flags for Copy and Resolve controls.

The component owns only transient delivery state. Durable issue state remains
in `useIssueStore`, and confirmed dispatch calls the existing `onMarkSent`
callback. Clipboard success remains independent and never marks an issue sent.

All active issue suggestions show **Send to agent** as the primary action.
**Copy prompt** remains available as a secondary fallback. Resolve remains
available where it exists today.

| Condition | Send action |
| --- | --- |
| Healthy hub and watcher | Enabled: **Send to agent** |
| Request in flight | Disabled: **Sending…** |
| Confirmed dispatch or already-sent issue | Disabled: **Sent** |
| Hub configured without a watcher | Disabled with watcher guidance |
| Hub offline or unconfigured | Disabled with MCP setup guidance |
| Dispatch rejected | Re-enabled and show the structured failure label |

The button remains visible while unavailable so users can discover the MCP
path. Its `title` and accessible label explain the immediate prerequisite.

`VibeCheck` already owns `beaconStatus`, `handleDispatch`, and
`handleMarkSent`. It will pass those same values to AgentPanel, both AuditPanel
instances, and AnnotationOverlay. No panel will create its own engine or
network client.

## MCP traffic exclusion

`createDuplicateRequestsDetector` will accept an optional list of ignored URL
prefixes. Matching uses a path boundary: an ignored base matches itself or a
descendant beginning with `/`, but not a different host or port whose string
happens to share the same prefix.

When the engine constructs the duplicate-request detector and `beaconUrl` is
configured, it supplies that URL as the ignored base. This excludes VibeCheck's
own:

- `POST /api/snapshot` beacon calls;
- `GET /api/projects/:projectId/status` polling; and
- `POST /api/projects/:projectId/dispatch` calls.

The wrapped `fetch` and XHR implementations still call through normally; the
filter only skips tracking. Without a configured beacon URL, duplicate-request
detection behaves exactly as it does today.

Examples:

| Request | Configured beacon | Tracked? |
| --- | --- | --- |
| `http://127.0.0.1:4200/api/projects/a/status` | `http://127.0.0.1:4200` | No |
| `http://127.0.0.1:4200/api/snapshot` | `http://127.0.0.1:4200/` | No |
| `http://127.0.0.1:4201/api/users` | `http://127.0.0.1:4200` | Yes |
| `http://127.0.0.1:4200.example/api/users` | `http://127.0.0.1:4200` | Yes |
| `/api/users` on the application origin | `http://127.0.0.1:4200` | Yes |

## Error handling

The shared component preserves the existing structured MCP outcomes:
`dispatched`, `agent-not-watching`, `queue-full`, `hub-offline`,
`invalid-issue`, `failed`, and `unconfigured`. A rejected or failed request does
not mutate tracked issue state. The user may retry after connection state or
queue capacity changes.

The traffic matcher treats malformed configured prefixes conservatively as
plain boundary-aware strings. It must never throw from an intercepted request
or prevent the underlying request from executing.

## Testing

React tests will prove:

- Agent, SEO, AEO, and annotation suggestions render **Send to agent**;
- an audit-row dispatch passes the exact issue and marks it sent only after a
  confirmed response;
- a failed dispatch remains unsent and shows the structured reason;
- unavailable connection states keep the action visible but disabled; and
- Copy prompt remains a clipboard-only fallback.

Core tests will prove:

- repeated calls under the configured MCP URL are ignored for fetch and XHR;
- other localhost ports and deceptive shared-prefix hosts remain tracked;
- ordinary application duplicates remain detected; and
- `VibeCheckEngine` passes its configured `beaconUrl` to the detector.

The packaged MCP round-trip remains the release-level proof that a button click
delivers the selected issue to the sole watching agent.

## Acceptance criteria

The batch is complete when every detector-backed suggestion surface exposes the
same connection-aware Send action, a confirmed click from an audit suggestion
reaches the MCP dispatch path, and periodic VibeCheck hub traffic no longer
produces duplicate-request issues while genuine localhost duplicates still do.
