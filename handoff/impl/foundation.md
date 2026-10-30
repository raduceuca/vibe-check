# Foundation report (protocol + version)

## Fixed

| ID | Where | Tests |
|---|---|---|
| P1, REL-1, E2E-01 (version part), SPEC-R0 | `packages/{core,mcp,react,protocol}/package.json:3` → `"version": "0.4.0"` (internal ranges are `workspace:*` / `workspace:^`, so nothing else changed; `pnpm install --lockfile-only --offline` left `pnpm-lock.yaml` unchanged) | `scripts/__tests__/version-sync.test.ts` › "keeps all four workspace packages in lockstep" |
| P3, SITE-09 (package side) | `packages/protocol/scripts/gen-version.mjs` (writer + `--check`), `packages/protocol/src/version.generated.ts`, `packages/protocol/src/index.ts` (`MCP_PACKAGE_NAME`, `MCP_PACKAGE_SPEC` built from `MCP_PACKAGE_VERSION`), `packages/protocol/package.json` (`build` runs the generator; new `gen:version`) | `src/__tests__/version.test.ts` (3 tests: matches package.json, `--check` passes, no literal in index.ts); `src/__tests__/protocol.test.ts` › "MCP package spec"; `scripts/__tests__/version-sync.test.ts` › "pins the version from packages/mcp/package.json", "ships the `up` command that the pinned setup commands use" |
| SITE-06 (package side) | `packages/protocol/src/toolCatalog.ts` (`MCP_TOOL_CATALOG`, `MCP_TOOL_NAMES`, `getMcpToolDescriptor`) | `src/__tests__/toolCatalog.test.ts` (5 tests) |
| Contract shapes for C1/C4/MCP-06/07/14 | `src/index.ts` (DetectorRunStatus, AuditRun, SnapshotTruncation, VibeIssue.lastSeenAt/occurrences, VibeSnapshot.detectors/engineStartedAt/truncation, Detector.getStatus?/getAuditRun?, IssueActionResult, IssueVerificationStatus, VerificationEvidence), `src/verification.ts` (`classifyVerificationSnapshot`, `DETECTOR_KINDS`, `issueLastSeenAt`, …), `src/issueIdentity.ts` (`getIssueIdentity`) | `src/__tests__/verification.test.ts` (13 tests), `issueIdentity.test.ts` › "exposes a page-independent identity…" |
| Contract shapes for C2/C5/MCP-03/08 | `src/payload.ts` (limits, `boundIssue/Issues/Snapshot`, `fitEnvelopeToBytes`, `measureJsonBytes`) | `src/__tests__/payload.test.ts` (16 tests, incl. "keeps a heavy snapshot under the keepalive budget…", "clamps title and description (C5…)") |
| Contract shapes for MCP-01/02/16 | `src/hubSecurity.ts` (origin/host/content-type/path helpers, `HUB_ERROR_CODES`, `HubErrorBody`) | `src/__tests__/hubSecurity.test.ts` (9 tests) |
| Contract shapes for MCP-04/05, E2E-02..05, E2E-12, MCP-15 | `src/index.ts` (`'leased'` state, `DISPATCHABLE_AGENT_STATES`, `'queued'`/`'origin-not-allowed'` codes, LeaseHolder, LeaseRequest, LeaseResult.holder/message, QueuedIssue.deliveryId/attempts, delivery receipts, `'dispatch-dropped'` event), `src/timing.ts`, `src/lease.ts` (`formatLeaseConflictMessage`, `agentClientLabel`) | `protocol.test.ts` › "accepts dispatches only while a live lease exists", enum lists; `src/__tests__/lease.test.ts` (3 tests) |
| Setup helpers for E2E-06/09, MCP-09, P10, W5 | `src/index.ts` (`getAgentClientSetup(client, { hubUrl })`, `getHubStartCommand`, `getDoctorCommand`, `formatSetupPack({ hubUrl, hubRunning })`, hub defaults) | `protocol.test.ts` › "carries a non-default hub into the agent config…", "passes a non-default port to up and hub", "points doctor at a non-default hub", "does not tell the user to start a second hub when one is running", "carries a non-default hub into every command in the pack" |
| Hard-coded `@0.3.0` asserts in protocol tests | `src/__tests__/protocol.test.ts` now derives every expected string from `packages/mcp/package.json` | — |

Verification run: `pnpm --filter @wcgw/vibe-check-protocol test` → 8 files, 70 tests pass. `lint` passes. Tests also type-check under strict mode (scratch tsconfig including `__tests__`). `build` succeeds; `dist/index.js` contains `MCP_PACKAGE_VERSION = "0.4.0"`, and every runtime name and type listed in CONTRACT §3.8 exists in `dist`.

## Partial / moved

- The docs-alignment test that lived in `protocol.test.ts` (it reads README.md, packages/*/README.md, demo/README.md and SKILL.md, none of which protocol owns) moved verbatim to `scripts/__tests__/version-sync.test.ts` › "first-class client setup docs match the protocol". It is **red by design** until release-docs and mcp-cli re-pin the docs to `@0.4.0`. Ownership of that file passes to release-docs.

## Handoffs

See CONTRACT.md §4. In short:
- react-widget: `IssueProgress.tsx` `EVENT_LABELS` needs `'dispatch-dropped'` (react lint fails without it); `AgentConnectionStatus.test.tsx:93` literal `@0.3.0`.
- mcp-cli: `doctor.test.ts:82,139` literal `@0.3.0`; doctor must handle `'leased'`.
- core-engine: re-export the names in CONTRACT §3.8 so react can use them.

## CHANGELOG bullets

- All packages move to 0.4.0 together. The setup commands the widget, `setup` and the docs print now pin `@wcgw/vibe-check-mcp@0.4.0`, which includes the guided `up` command. Update any MCP config that still pins `@0.3.0`.
- The pinned MCP version is now generated from the MCP package version at build time, so setup commands cannot point at a version that does not exist.
- Setup commands can carry a non-default hub port: the agent config gets `VIBE_CHECK_HUB_URL`, `up`/`hub` get `--port`, and `doctor` gets `--hub-url`.
- The setup pack no longer tells you to start a second hub when one is already running, and it ends with a read-only `doctor` check.

## Risks

- `[UNVERIFIED]` The `claude mcp add … -e KEY=VAL --` and `codex mcp add … --env KEY=VAL --` forms were checked against the local `--help` output, but not executed. Run `pnpm test:clients` at integration.
- `formatSetupPack` output changed (doctor line; optional "already running" step). Only protocol tests asserted it.
- New enum members (`'leased'`, `'queued'`, `'origin-not-allowed'`, `'dispatch-dropped'`) are appended. Consumers using exhaustive `Record<…>` maps fail to type-check until they add entries, by design.
- `src/enums.ts` now holds `SEVERITIES` / `DETECTOR_NAMES` (moved verbatim from index.ts and re-exported) so the helper modules avoid a runtime import cycle. Public names are unchanged.
