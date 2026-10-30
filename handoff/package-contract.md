# VibeCheck 0.4.0 implementation contract

- Repo: `/Users/raduceuca/development/vibe-check`, branch `widget/retire-proof-branding`
- Written by: foundation engineer, 2026-10-30
- Inputs: `scratchpad/audit/findings-{publish,live,core,widget,mcp,site,release}.md`, `scratchpad/site/SPEC.md` (§1 R0/P1–P5, §6 mcp.json / MCP_TOOL_CATALOG)
- Status of the foundation work: **done and green.** `packages/protocol` holds every cross-package shape below; `pnpm --filter @wcgw/vibe-check-protocol test` (70 tests), `lint`, and `build` pass. All four packages are `0.4.0`.

Read §0 first, then your own rows in §1 and §2, then every §3 contract your package touches. When this file and a finding disagree, this file wins; record the disagreement in your report.

---

## 0. Rules for every implementer

1. Edit only files in your ownership row (§1). Need a change elsewhere? Do not make it: add a line under "handoffs" in your report (file, exact change, why).
2. No git commit/push/stash/reset/checkout/branch, no publish/deploy, no `pnpm add`/`npm install <pkg>`, no dependency upgrades.
3. Leave the uncommitted line in `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts:219` (`await connection.getByRole('button', { name: 'Need to add the MCP server?' }).click()`) intact.
4. CLAUDE.md rules: TypeScript strict, no `any`, named arrow-function exports, immutable updates, core has zero runtime deps, widget uses inline styles only, tests co-located in `__tests__/`, every behaviour change gets a test.
5. PRODUCT.md: evidence over assertion, one owner per project, honest language. Banned copy: print/press/proof metaphor (proof, press check, plate, register, CMYK, crop ticks), "quiet instrument", accent-split headlines. Readable widget copy ≥ 14 px, pure neutral colours, status colours only for semantic state.
6. Decisions already made by Radu: version `0.4.0` lockstep; info-level findings keep counting toward the widget's problem count and health; no-hub "mark as fixed" becomes an honest "dismiss".
7. Smallest correct change. Keep public API backward compatible; when a finding forces a break, document it as a CHANGELOG "Breaking" bullet in your report.
8. Before finishing: your package's `test` and `lint`; build only your own package (`pnpm --filter <pkg> build`), never the whole repo concurrently.
9. Report to `scratchpad/impl/<your-id>.md`: fixed IDs (file:line + test names), skipped/partial IDs with honest reasons, handoffs, user-facing CHANGELOG bullets, risks.
10. Protocol is frozen for this phase. If you need a protocol change, put it under handoffs; do not edit `packages/protocol/**`.
11. Everyone edits the same working tree in parallel. Prefer `Edit` over `Write` on shared-looking files; re-read before editing if a tool reports the file changed.

---

## 1. Ownership map (disjoint)

| Owner | Files (globs) |
|---|---|
| **foundation** (done) | `packages/protocol/**`; the `"version"` field of `packages/{core,mcp,react,protocol}/package.json`; `pnpm-lock.yaml` (no change was needed). Created `scripts/__tests__/version-sync.test.ts`, whose ownership passes to release-docs. |
| **core-engine** | `packages/core/src/engine.ts`, `src/scriptedEngine.ts`, `src/types.ts`, `src/index.ts`, `src/beacon/**`, `src/collectors/{frameRate,longFrames,memory,webVitals,console}.ts`, `src/collectors/__tests__/{frameRate,longFrames,memory,webVitals,console}.test.ts`, `src/utils/{ringBuffer,featureDetect}.ts`, `src/utils/__tests__/{ringBuffer,featureDetect}.test.ts`, `src/__tests__/` except `detectorContract.test.ts` (engine/scripted/console tests and any new engine-level tests), `packages/core/{package.json (non-version fields), tsup.config.ts, vitest.config.ts, tsconfig.json, tsconfig.lint.json}` |
| **core-detectors** | `packages/core/src/detectors/**`, `src/suggestions/**`, `src/collectors/resources.ts`, `src/collectors/__tests__/resources.test.ts`, `src/utils/probe.ts` (new), `src/utils/__tests__/probe.test.ts` (new), `src/__tests__/detectorContract.test.ts`, `packages/core/scripts/**`, `packages/core/README.md`, plus the generated block between `<!-- BEGIN GENERATED DETECTOR REFERENCE -->` and `<!-- END GENERATED DETECTOR REFERENCE -->` in `skills/vibe-check/SKILL.md`, written only by running `pnpm gen:docs` once, at the end of your work |
| **mcp-hub** | `packages/mcp/src/{hubServer,hubStore,workflow,schema,persistence,store,impact,impactAdapters,hubClient,leaseManager,mcpServer,types,lib}.ts`, `packages/mcp/src/suggestions/**`, `packages/mcp/src/__tests__/{hubServer,hubStore,workflow,schema,persistence,store,impact,impactAdapters,hubClient,leaseManager,mcpServer,suggestions}.test.ts` and new tests for those modules, `e2e/**` (keep the line in rule 3) |
| **mcp-cli** | `packages/mcp/src/{cli,index,main,setup,doctor,fatal,projectRegistry}.ts`, `packages/mcp/src/__tests__/{cli,main,setup,doctor,fatal,projectRegistry}.test.ts` and new tests for those modules, `packages/mcp/{package.json (non-version fields), tsup.config.ts, vitest.config.ts, tsconfig.json, tsconfig.lint.json, README.md}` |
| **react-widget** | `packages/react/**` (src, scripts, README.md, tsup/vitest/tsconfig, package.json non-version fields). Leave the untracked `packages/react/.impeccable/` alone. |
| **release-docs** | root `README.md`, `CHANGELOG.md` (integration step only; leave to the integrator), `AGENTS.md`, `CLAUDE.md`, `docs/**` (not apps/web), `skills/vibe-check/**` (except the generated block above), `.github/**`, `scripts/**` (including `scripts/__tests__/version-sync.test.ts`), root `package.json` scripts, `.gitignore`, `vitest.workspace.ts` / a new root `vitest.config.ts`, a new `.nvmrc`, `demo/**` (version strings and command pins only) |
| **out of scope** (site phase) | `apps/web/**`, `apps/scan-worker/**`. Untracked local tooling (`.agents/`, `.claude/`, `.codex/`, `.impeccable/`, `PRODUCT.md`, `skills-lock.json`, `skills/autofix`, `skills/code-review`, `tastefiles/`): release-docs may add ignore rules (REL-11) but must not delete, move, or commit anything. Do not ignore `PRODUCT.md` or `tastefiles/`; Radu decides whether to commit them. |

Package READMEs belong to the package owner: `packages/core/README.md` → core-detectors, `packages/mcp/README.md` → mcp-cli, `packages/react/README.md` → react-widget.

---

## 2. Finding assignment

Each ID has exactly one accountable owner. "Also" lists contract obligations other owners must meet (see §3); they are not separate ownership.

### publish (P*)

| ID | Owner | Notes |
|---|---|---|
| P1 | foundation | **Done.** All four packages 0.4.0. CHANGELOG is P8. |
| P2 | release-docs | Root README, SKILL, demo pins. The widget and protocol constant are already derived (P3). Also: mcp-cli (`packages/mcp/README.md`), react-widget (`packages/react/README.md`). |
| P3 | foundation | **Done.** `MCP_PACKAGE_SPEC` derived from `packages/mcp/package.json` (§3.1); tests compare against package.json. |
| P4 | react-widget | `'use client'` banner + test + Next.js README section. |
| P5 | react-widget | SSR hydration (same root cause as W1). |
| P6 | mcp-cli | Generated component must type-check in a stock Vite app. |
| P7 | release-docs | Re-capture screenshots without print chrome. If that is not possible in this phase, remove the embeds and say so honestly. |
| P8 | release-docs | CHANGELOG `## 0.4.0`, written by the integrator from everyone's bullets. |
| P9 | react-widget | 10 tools in the README. Generate the list from `MCP_TOOL_CATALOG`, or link to the mcp README table. |
| P10 | mcp-cli | `up --port` banner (§3.2). |
| P11 | mcp-cli | `--help` / `--version`. |
| P12 | mcp-cli | CLI entry ESM-only, no dts. |
| P13 | core-engine | Duplicate sourceMappingURL in core. react-widget applies the same one-line fix in `packages/react/tsup.config.ts` while doing P4. |
| P14 | react-widget | Absolute image URLs; delete the commented duplicates. |

### live (E2E-*)

| ID | Owner | Notes |
|---|---|---|
| E2E-01 | foundation | **Done** (version + derived spec). Doc pins: P2. |
| E2E-02 | mcp-hub | Queue survives release/exit/restart (§3.6). |
| E2E-03 | mcp-hub | Abort-aware long-poll + two-phase delivery (§3.6). |
| E2E-04 | mcp-hub | `watching` vs `leased`, `queued` result (§3.6). Also: react-widget display (§3.10). The quickstart text is site phase. |
| E2E-05 | mcp-hub | Only the lease owner may acknowledge/resolve (§3.6). |
| E2E-06 | mcp-cli | Port/hub URL carried everywhere (§3.2, §3.11). Also: react-widget uses `beaconUrl` in the pack. |
| E2E-07 | mcp-hub | `get_project_impact` works for inactive projects (§3.3 item 10). |
| E2E-08 | mcp-cli | `packages/mcp/README.md`: list_projects fields, resolve_issue semantics, envelope fields. The apps/web docs are site phase. |
| E2E-09 | mcp-cli | EADDRINUSE handling; pack with `hubRunning`. Also: react-widget passes `hubRunning`. |
| E2E-10 | mcp-cli | `up` reads `.vibecheck/config.json` / package.json name. |
| E2E-11 | mcp-cli | CLI messages. |
| E2E-12 | mcp-hub | Lease-conflict copy via `formatLeaseConflictMessage` (§3.6). |
| E2E-13 | mcp-hub | `impact.ts` formatters print `${value} ${label}`. |
| E2E-14 | release-docs | Fix any root README / SKILL wording that says Alt+Shift+V expands the widget. apps/web is site phase. |
| E2E-15 | release-docs | README "press check" line. |
| E2E-16 | mcp-cli | setup.ts:340 prints the agent label. The `"1 seconds"` string is in mcpServer.ts: mcp-hub fixes it with the tool-result copy (§3.6). |

### core (C*)

| ID | Owner | Notes |
|---|---|---|
| C1 | core-engine | Snapshot carries `engineStartedAt` + `detectors` (§3.3). Also: core-detectors implements `getStatus()`, and uses `encodedBodySize` for cache hits; mcp-hub applies the rule (MCP-06). |
| C2 | core-engine | `boundSnapshot` + `fitEnvelopeToBytes`, keepalive policy, distinct failure status (§3.4, §3.9). Also: core-detectors keys issues (C4). |
| C3 | core-detectors | Probe fetches (SPEC-P1). |
| C4 | core-detectors | One issue per identity, `lastSeenAt`, retraction (§3.3). Also: core-engine `recheck` (SPEC-P2); react-widget calls `recheck` on verification. |
| C5 | core-detectors | `createIssue` clamps via `boundIssue`; truncated URL in title/description. |
| C6 | core-engine | Beacon chatter (no post-send status refresh, no hidden-tab sends, backoff). Also: core-detectors move resource-bloat / large-images / heavy-library to `PerformanceObserver({ type: 'resource', buffered: true })`. |
| C7 | core-detectors | memory-leak heuristic. |
| C8 | core-detectors | duplicate-requests GraphQL / StrictMode / Request method. |
| C9 | core-engine | INP. |
| C10 | core-engine | Dropped-frame threshold. |
| C11 | core-detectors | layout-shift copy and clustering. |
| C12 | core-detectors | Resource classification (owns `collectors/resources.ts`). |
| C13 | core-detectors | heavy-library selectors. |
| C14 | core-detectors | unoptimized-images load / CSS sizing. |
| C15 | core-engine | SPA route-change hook calls `recheck` for audits. Also: core-detectors makes audits re-runnable with one probe cache per run batch. |
| C16 | core-detectors | console-spam cost. |
| C17 | core-engine | Beacon backoff. |
| C18 | core-detectors | Patched fetch never throws; ownership-checked restore. |
| C19 | core-detectors | Double `start()` guards (incl. ResourceCollector) + contract test. |
| C20 | core-engine | `enabled`, non-browser `start()`. |
| C21 | core-detectors | long-task URL query stripping, threshold docs. |
| C22 | core-engine | Hidden-tab frame gap. |
| C23 | core-detectors | AEO script/style text. |
| C24 | core-detectors | Image suggestion labels. |
| C25 | core-detectors | Generated reference accuracy. |
| C26 | core-engine | Exclude `[data-wcgw]` subtrees from `domNodeCount` (§3.8). Also: core-detectors' domBloat depth walk skips them; react-widget keeps `data-wcgw` on every root, including portals. |

### widget (W*) — all react-widget

W1, W2, W3, W4 (with SPEC-P4), W5, W6 (README embeds; re-capture is P7), W7, W8, W9, W10, W11, W12, W13, W14, W15, W16, W17, W18, W19, W21, W22, W23, W24, W25, W26, W27, W28. (There is no W20.)

### mcp (MCP-*)

| ID | Owner | Notes |
|---|---|---|
| MCP-01 | mcp-hub | Origin/Host/Content-Type policy (§3.5). Also: mcp-cli adds `--allow-origin`, env, `register --origin` (§3.11). |
| MCP-02 | mcp-hub | `safeDecodePathSegments`; wrap the handler. |
| MCP-03 | mcp-hub | Caps and eviction (§3.4). |
| MCP-04 | mcp-hub | §3.6. |
| MCP-05 | mcp-hub | §3.6. |
| MCP-06 | mcp-hub | `classifyVerificationSnapshot` rule; attribution rule for impact (§3.3). |
| MCP-07 | mcp-hub | Resolve/acknowledge by stable key; loud `issue-not-found` (§3.3). |
| MCP-08 | mcp-hub | Accept and truncate (§3.4). |
| MCP-09 | mcp-cli | `up` EADDRINUSE + banner. |
| MCP-10 | mcp-cli | Registry re-point / `--force` / `unregister`; prototype-safe maps. |
| MCP-11 | mcp-cli | Windows `.cmd` shims (`shell: true` on win32 with quoted args), or document as unsupported. |
| MCP-12 | mcp-hub | No negative caching of registry lookups. Also: mcp-cli's `up --project` registers the cwd only when its `.vibecheck/config.json` or package.json name matches the project id. |
| MCP-13 | mcp-hub | Persist only on meaningful change. |
| MCP-14 | mcp-hub | Verification status route + `resolve_issue.wait_seconds` (§3.3 item 9). |
| MCP-15 | mcp-hub | Same fix as E2E-12. |
| MCP-16 | mcp-hub | 413 / 400 / 500 split. |
| MCP-17 | mcp-cli | Same fix as P11. |

### release (REL-*)

| ID | Owner | Notes |
|---|---|---|
| REL-1 | foundation | **Done** (versions). CHANGELOG is P8. `docs/releasing.md` example version → release-docs (under REL-16). |
| REL-2 | release-docs | `release:validate` fails on any `vibe-check-mcp@X.Y.Z` pin in README.md, packages/*/README.md, skills/**/SKILL.md, demo/** that differs from the release version, and when `src/version.generated.ts` is stale (`node packages/protocol/scripts/gen-version.mjs --check`). Do not include apps/web until the site phase updates it. |
| REL-3 | release-docs | Preflight step that fails before the npm publish when the Cloudflare secrets are empty. Adding the secrets is Radu's action: mark it partial. |
| REL-4 | release-docs | Root README screenshots (same work as P7). |
| REL-5 | release-docs | README lead + `docs/launch/**` copy. |
| REL-6 | release-docs | Real tarball-content assertions (`pnpm pack` + file-list checks, `--ignore-scripts`). |
| REL-7 | release-docs | Prerelease → `--tag next`; skip `--latest`. |
| REL-8 | react-widget | `size-check.mjs` measures the consumer bundle; liveline stays lazy. |
| REL-9 | release-docs | Root vitest `projects` config; make `test:coverage` work. |
| REL-10 | release-docs | CI Node 22/24, `.nvmrc`, root engines. Package `engines` fields stay unless the package owner changes them. |
| REL-11 | release-docs | `.gitignore` local tooling (see §1 for what must not be ignored). |
| REL-12 | release-docs | Smoke-script coverage for `/scan`, `/md`, `/fix`, POST `/api/scan`. The build marker lives in apps/web: site phase. |
| REL-13 | release-docs | Pin actions to SHAs. The environment branch policy is a GitHub setting: Radu's action, partial. |
| REL-14 | release-docs | Rerun-safety check or documented rule. |
| REL-15 | release-docs | release.yml env + docs/releasing.md. App-side localhost guards: site phase. |
| REL-16 | release-docs | CLAUDE.md/AGENTS.md hook list (do not add a `useProjectImpact` export), CHANGELOG header wording, release notes from the CHANGELOG section. |
| REL-17 | release-docs | Internal memo + retired-brand specs: add a "Superseded" header, or move them per Radu. Never delete without his OK; note it. |
| REL-18 | release-docs | Rename or remove `publish:all`. |

### site spec §1 (SPEC-*; the spec's P1–P5 are not the publish P1–P5)

| ID | Owner | Notes |
|---|---|---|
| SPEC-R0 | foundation | **Done**: bump, derived spec, `scripts/__tests__/version-sync.test.ts`. The publish is Radu's. |
| SPEC-P1 | core-detectors | `utils/probe.ts` (§3.8). Also: core-engine exports `probeFetch` from index and passes one probe cache to seo+aeo. |
| SPEC-P2 | core-engine | `clearIssues(detector?)`, `recheck?`, `getAuditRun?` on `VibeEngine` (§3.8). Also: core-detectors implements `getAuditRun()` on the three audits. |
| SPEC-P3 | core-detectors | `'vite + react + ts'`, `'create next app'` placeholder titles + tests. |
| SPEC-P4 | react-widget | No-hub `dismiss` (Radu approved; §3.10 item 7). |
| SPEC-P5 | deferred | Site phase (stop-safe engine handle). |

### site (SITE-*)

| ID | Owner | Notes |
|---|---|---|
| SITE-04 (package side) | mcp-hub | Register tools from `MCP_TOOL_CATALOG` (catalog done by foundation). Site copy: deferred. |
| SITE-05 (package side) | mcp-cli | `packages/mcp/README.md` lifecycle and resolve wording. Catalog wording done by foundation. Site: deferred. |
| SITE-06 (package side) | foundation | **Done**: `MCP_TOOL_CATALOG`, `MCP_PACKAGE_SPEC` exported. The card generator `apps/web/scripts/gen-mcp-card.mjs` is site phase. Also: core-engine re-exports the catalog from core (§3.8), so apps/web can read it through its existing core dependency. |
| SITE-07 (package side) | core-detectors | Self-inflicted duplicate-request issues (SPEC-P1). Also: core-engine C26 (the widget's own DOM). The GIF and landing DOM size are site phase. |
| SITE-09 (package side) | foundation | **Done**: one derived spec. The site pins themselves are site phase. |
| SITE-01 | release-docs via REL-3 | The rest is site phase. |
| SITE-02, SITE-03, SITE-08, SITE-10, SITE-11, SITE-12, SITE-13, SITE-14, SITE-15 | deferred | Site phase (apps/web, apps/scan-worker). |

---

## 3. Cross-package contracts

Everything named here is **already exported from `@wcgw/vibe-check-protocol`** (source: `packages/protocol/src/{index,enums,timing,payload,verification,hubSecurity,lease,toolCatalog,issueIdentity}.ts`). Read the source for full doc comments. Core and mcp resolve protocol from source in tests and lint (tsconfig paths / vitest alias). React and e2e resolve the built `packages/protocol/dist` (already built).

### 3.1 Version and package spec (P1, P3, E2E-01, REL-1, SPEC-R0)

- `packages/protocol/src/version.generated.ts` holds `export const MCP_PACKAGE_VERSION = '0.4.0'`. It is **generated** by `packages/protocol/scripts/gen-version.mjs` from `packages/mcp/package.json`, and `pnpm --filter @wcgw/vibe-check-protocol build` regenerates it. `node packages/protocol/scripts/gen-version.mjs --check` exits 1 when it is stale.
- `MCP_PACKAGE_NAME = '@wcgw/vibe-check-mcp'`, `WIDGET_PACKAGE_NAME = '@wcgw/vibe-check'`, `MCP_PACKAGE_SPEC = `${MCP_PACKAGE_NAME}@${MCP_PACKAGE_VERSION}``. `HUB_START_COMMAND` and `UP_START_COMMAND` are built from it.
- Guards: `packages/protocol/src/__tests__/version.test.ts` (spec equals package.json, generator check passes, no literal in index.ts) and `scripts/__tests__/version-sync.test.ts` (spec equals package.json, four packages in lockstep, `cli.ts` still has `vibe-check-mcp up` / `role === 'up'`).
- **mcp-cli:** keep the usage text containing `vibe-check-mcp up` in `packages/mcp/src/cli.ts`. If you move it, hand off a matching update of version-sync.test.ts to release-docs.
- The mcp CLI keeps its own `__VIBE_CHECK_VERSION__` tsup define (same package.json, so the two always agree). `setup.ts` may use `MCP_PACKAGE_SPEC` / `WIDGET_PACKAGE_NAME` directly.
- **Never type a version literal in source or docs again**: build pins from `MCP_PACKAGE_SPEC`, or check them in `release:validate` (REL-2).

### 3.2 Setup helpers carry the hub URL (E2E-06, E2E-09, MCP-09, P10, W5)

```ts
DEFAULT_HUB_HOST = '127.0.0.1'; DEFAULT_HUB_PORT = 4200; DEFAULT_HUB_URL = 'http://127.0.0.1:4200'
HUB_URL_ENV = 'VIBE_CHECK_HUB_URL'
normalizeHubUrl(hubUrl?: string | null): string        // trims, strips trailing '/', default when empty
hubPortFromUrl(hubUrl: string): number | null

interface AgentClientSetupOptions { readonly hubUrl?: string }
getAgentClientSetup(client: AgentClientId, options?: AgentClientSetupOptions): AgentClientSetup
//   non-default hub →  codex:  codex mcp add vibe-check --env VIBE_CHECK_HUB_URL=<url> -- npx -y <spec> connect
//                      claude: claude mcp add --scope local vibe-check -e VIBE_CHECK_HUB_URL=<url> -- npx -y <spec> connect
//                      cursor: { "vibe-check": { command, args, env: { VIBE_CHECK_HUB_URL } } }

interface HubStartCommandOptions { preferUp?: boolean; projectId?: string; agent?: AgentClientId; hubUrl?: string }
getHubStartCommand(options?): string     // `npx -y <spec> up [--project X] [--agent Y] [--port N]` or `npx -y <spec> hub [--port N]`
getDoctorCommand(projectId: string, hubUrl?: string): string   // `... doctor --project X [--hub-url <url>]`

interface SetupPackOptions {
  readonly projectId: string; readonly agent: AgentClientId; readonly preferUp?: boolean
  readonly hubUrl?: string      // since 0.4
  readonly hubRunning?: boolean // since 0.4: step 1 says "already running at <url>", no start command
}
formatSetupPack(options): string   // now ends with "Check the connection (read-only): <doctor command>"
```

- **mcp-cli must make these commands real:** `hub --port <n>`, `up --port <n>` (strict: reject invalid ports with a plain message), `doctor --hub-url <url>`, `stats --hub-url <url>`. The `up` banner calls `formatSetupPack({ projectId, agent, hubUrl, hubRunning: true })`.
- **react-widget:** `formatSetupPack({ projectId, agent: client, hubUrl: beaconUrl, hubRunning: <hub reachable> })`. Client snippets come from `getAgentClientSetup(client, { hubUrl: beaconUrl })`, the hub command from `getHubStartCommand({ hubUrl: beaconUrl, ... })`, the default URL from `DEFAULT_HUB_URL`.
- `[UNVERIFIED]` The env-flag placement was checked against `claude mcp add --help` (example `claude mcp add my-server -e API_KEY=xxx -- npx my-mcp-server`) and `codex mcp add --help` (`--env <KEY=VALUE>`), but not executed. release-docs runs `pnpm test:clients` at integration.

### 3.3 Verification soundness (C1, C4, MCP-06, MCP-07, E2E-07, MCP-14)

**Goal.** The hub accepts "issue absent" as fix evidence only from a detector that observed the page after the verification request. HMR fixes verify without a reload. Never-sent issues create no verified-fix receipts. Actions on unknown ids fail loudly. Agents can read the outcome. Impact stays readable after the tab closes.

**Protocol shapes (exported now):**

```ts
interface VibeIssue {            // existing fields unchanged; additions:
  readonly lastSeenAt?: number   // producer clock; >= timestamp; read via issueLastSeenAt()
  readonly occurrences?: number  // >= 1
}
type DetectorKind = 'continuous' | 'audit'
const DETECTOR_KINDS: Record<DetectorName, DetectorKind>   // audits: seo, aeo, web-essentials
const AUDIT_DETECTORS = ['seo', 'aeo', 'web-essentials'] as const; type AuditDetectorName
interface DetectorRunStatus {
  readonly detector: DetectorName; readonly kind: DetectorKind
  readonly observingSince: number          // reset by start(), clear(), recheck(), SPA re-run
  readonly settledAt: number | null        // first full evaluation since observingSince
  readonly evaluatedAt: number | null      // continuous: snapshot time once settled; audit: last run finish
  readonly inconclusiveChecks?: readonly string[]   // audit checks the last run could not evaluate
}
type AuditRunStatus = 'running' | 'complete' | 'incomplete'
interface AuditRun { detector: AuditDetectorName; status; startedAt; finishedAt?; failedChecks: readonly string[]; unreachable: readonly string[] }
interface SnapshotTruncation { droppedIssues: number; detectors: readonly DetectorName[]; truncatedFields: number }
interface VibeSnapshot {         // additions, all optional (0.3 producers omit them = "legacy")
  readonly engineStartedAt?: number
  readonly detectors?: readonly DetectorRunStatus[]
  readonly truncation?: SnapshotTruncation
}
interface Detector {             // additions, optional for third-party implementations
  getStatus?(): DetectorRunStatus
  getAuditRun?(): AuditRun | null
}
getIssueIdentity(issue): string                  // `${detector}|${identity}`, page-independent
issueLastSeenAt(issue): number
getDetectorRunStatus(snapshot, detector): DetectorRunStatus | null
VERIFICATION_CLEAN_SNAPSHOTS = 2
LEGACY_VERIFICATION_DELAY_MS = 30_000
classifyVerificationSnapshot({ snapshot, issue, present, requestedAt }): VerificationEvidence
type VerificationEvidence =
  | { kind: 'recurred'; at: number }
  | { kind: 'clean'; confidence: 'measured' | 'estimated' }
  | { kind: 'inconclusive'; reason: VerificationInconclusiveReason }
type VerificationInconclusiveReason = 'snapshot-before-request' | 'stale-issue' | 'detector-not-running'
  | 'detector-not-settled' | 'evaluation-before-request' | 'check-not-evaluated' | 'truncated' | 'legacy-too-soon'
```

`classifyVerificationSnapshot` is the rule; see `verification.ts` and its tests. In short: a snapshot not newer than the request is inconclusive. A present issue means recurred only if its `lastSeenAt` is after the request (legacy: any presence, the 0.3 rule); otherwise it is a stale latch and inconclusive. An absent issue counts as clean only if the detector is listed, settled, evaluated after the request, not truncated, and able to evaluate that check. A legacy absence counts only after 30 s, with `'estimated'` confidence.

**Producer obligations: core-detectors**
1. Every built-in detector implements `getStatus()` per the field docs. `kind` comes from `DETECTOR_KINDS`. Choose a documented settle window per detector: duplicate-requests ≥ its 2 s window; console-spam after its first check; memory-leak after its first full window; dom-bloat after its first check; images, resources and heavy-library after their first scan; layout-thrashing and long-task after a short observation (use `buffered: true` where the API allows). A detector that cannot observe in this browser (no `performance.memory`, no LoAF) keeps `settledAt: null`.
2. At most one open issue per `getIssueIdentity()`. Its `id` stays the same while it is open. Update `lastSeenAt` and `occurrences` in place, immutably (a new object, same id). Event detectors retract the issue when the condition has not recurred within their retention window. State detectors retract it when the condition is false at evaluation, and **refresh `lastSeenAt` on every evaluation that still sees the condition**. A recurrence after retraction raises a new id with `timestamp = lastSeenAt = now`.
3. `clear()` resets issues, dedupe state, `observingSince = now`, `settledAt = null`.
4. Audits: `getAuditRun()` returns the latest run. `unreachable` lists checks whose probe threw a network error (not a 404), and the same ids go into `getStatus().inconclusiveChecks`.
5. large-images and resource-bloat use `encodedBodySize` (or `decodedBodySize`) when `transferSize === 0` (a cache hit), so a reload does not "fix" them (C1 second path).

**Producer obligations: core-engine**
6. `getSnapshot()` sets `engineStartedAt` and `detectors` (each enabled detector's `getStatus()`). For a detector without `getStatus`, emit `{ detector, kind: DETECTOR_KINDS[name], observingSince: engineStartedAt, settledAt: null, evaluatedAt: null }`.
7. `clearIssues(detector?: DetectorName)`: no argument clears all (as today); an argument clears one.
8. `recheck?(detector)`: stop → clear → start that detector. Resolves when its `settledAt !== null`, or after a 30 s cap. Audits batched together (seo + aeo) share one fresh probe cache.
9. SPA navigation (C15): patch `history.pushState` / `replaceState` once, listen to `popstate`, debounce about 300 ms, then `recheck` the three audits. Restore the history patches on `stop()` with an ownership check.

**Widget obligation: react-widget**
10. When the polled workflow shows a tracked issue in phase `'verifying'` whose latest `'verification-requested'` event is newer than the one already handled for that `issueKey`, call `engine.recheck?.(tracked.issue.detector)` once (dedupe per detector within about 2 s). This applies to requests from MCP `resolve_issue` and from the widget's own "check this fix". This is how HMR fixes verify.

**Hub obligations: mcp-hub**
11. For each tracked issue in `'verifying'`, and each snapshot from the same normalized pageUrl, call `classifyVerificationSnapshot` with `requestedAt` converted to the producer clock: `requestedAt - (hubReceivedAt - snapshot.timestamp)`.
    - `recurred` → `'verification-failed'` event, phase `'working'`, misses 0.
    - `clean` → `verificationMisses + 1`; at `VERIFICATION_CLEAN_SNAPSHOTS` distinct snapshot timestamps → `'fixed'`. Impact receipts take the evidence confidence (`'estimated'` for legacy).
    - `inconclusive` → no change; remember the reason for `waitingFor`.
    - Hub-side truncation must also mark `truncation.detectors` (use `boundSnapshot`), so the classifier sees it.
12. Attribution (MCP-06): an issue never sent may still reach `'fixed'` (the widget's "check this fix" is allowed). `deriveProjectImpact` counts `verifiedFixes`, `uniqueIssuesFixed` and fix times only for `'fixed'` events whose occurrence has a `'sent'` event. Receipts already require a dispatch baseline; keep that.
13. Resolve/acknowledge/verify by stable key (MCP-07): find the `VibeIssue` for the id (latest snapshot → history → tracked `occurrenceIds`), compute `getStableIssueKey(projectId, pageUrl, issue)`, act on that tracked issue. Results use `IssueActionResult`:
    ```ts
    ISSUE_ACTION_CODES = ['acknowledged','verifying','already-verifying','already-fixed','issue-not-found','project-not-found','lease-conflict']
    interface IssueActionResult { ok; code: IssueActionCode; projectId; issueId; issueKey: string | null; phase: IssuePhase | null; holder?: LeaseHolder }
    ```
    HTTP: 200 for `acknowledged` / `verifying` / `already-verifying` / `already-fixed`; 404 for `issue-not-found` / `project-not-found`; 409 for `lease-conflict`. The browser `POST /api/projects/:id/issues/:issueId/verify` returns the same body (0.3 widgets only read the HTTP status, so this stays compatible).
14. Verification status (MCP-14): `GET /internal/projects/:id/issues/:issueId/verification` → `IssueVerificationStatus`:
    ```ts
    VERIFICATION_OUTCOMES = ['pending','fixed','still-present','not-requested']
    interface IssueVerificationStatus { projectId; issueId; issueKey; phase; outcome; requestedAt: number|null; decidedAt: number|null;
      cleanSnapshots: number; requiredCleanSnapshots: number; waitingFor: VerificationInconclusiveReason | 'no-snapshot-yet' | null }
    ```
    `resolve_issue` gains `wait_seconds` (0–55, default 0; see the catalog). When it is > 0, poll that route every second until the outcome is no longer `'pending'` or time runs out. Return `{ ...IssueActionResult, issue_id, verification, message }`. The message never says "fixed" unless the outcome is `'fixed'`.
15. Inactive projects (E2E-07): `get_project_impact` with an explicit `project_id` uses `client.getProjectImpact` even when the project is not in the active list. Other project tools return `{ code: 'project-inactive', projectId, lastSeenAt }` (isError) for known but idle projects, instead of `project-not-found`.
16. Persistence schema: accept the event type `'dispatch-dropped'` and the optional new issue fields (`lastSeenAt`, `occurrences`).

### 3.4 Payload bounding (C2, C5, MCP-03, MCP-08)

```ts
interface PayloadLimits { maxIssuesPerSnapshot; maxIssuesPerDetector; maxTitleChars; maxDescriptionChars;
  maxEvidenceStringChars; maxEvidenceArrayItems; maxEvidenceKeys; maxEvidenceDepth;
  maxLongFrameEntries; maxScriptsPerLongFrame; maxLargeResources; maxEnvelopeTextChars }
PAYLOAD_LIMITS     = { 100, 25, 160, 600, 1000, 20, 24, 3, 20, 5, 20, 2000 }   // browser producer
HUB_INTAKE_LIMITS  = { 200, 50, 300, 2000, 2000, 50, 50, 4, 50, 10, 50, 2000 } // hub keeps at most this
KEEPALIVE_BODY_LIMIT_BYTES = 65_536; SNAPSHOT_BODY_BUDGET_BYTES = 48_000; HUB_MAX_BODY_BYTES = 1_048_576
truncateText(value, maxChars); boundEvidence(evidence, limits?); boundIssue(issue, limits?)
compareIssuePriority(a, b)       // severity desc, then lastSeenAt desc, then timestamp desc
boundIssues(issues, limits?): { issues; dropped; droppedDetectors; truncatedFields }  // keeps original order
boundSnapshot(snapshot, limits?): VibeSnapshot    // same object when already within limits; merges truncation
measureJsonBytes(value): number
fitEnvelopeToBytes(envelope, maxBytes = 48_000, limits?): ProjectSnapshotEnvelope   // drops lowest-priority issues last
```

- **core-detectors:** `createIssue` returns `boundIssue(...)` and sets `lastSeenAt = timestamp`, `occurrences = 1`. duplicate-requests puts a truncated URL (≤ 120 chars, as resource-bloat does) in the title and description; the bounded full URL goes in evidence.
- **core-engine:** `getSnapshot()` returns `boundSnapshot(raw)`. The beacon body is `JSON.stringify(fitEnvelopeToBytes(envelope))`. Never send a body over 64 KiB with `keepalive: true`. Routine POSTs may drop keepalive; keep it for a final `pagehide` send. Map 413 → `payload-too-large`, 400 → `rejected`, 403 with `code: 'origin-not-allowed'` → `origin-not-allowed`, network error → `hub-offline` (§3.9).
- **mcp-hub:** accept and truncate. Apply `boundSnapshot(snapshot, HUB_INTAKE_LIMITS)` and truncate envelope strings, instead of rejecting on length or count. Remove `.max(500)` and string-length rejections from `schema.ts`. Reject only structurally invalid envelopes (400 `bad-request`) and bodies over `HUB_MAX_BODY_BYTES` (413 `payload-too-large`: stop reading, respond, close). Validate the optional `engineStartedAt`, `detectors` and `truncation` fields. Strip unknown top-level snapshot keys; keep the known stat blocks.
- **mcp-hub memory caps (MCP-03):** at most 100 projects in memory. LRU-evict projects idle more than 1 h that are unregistered, hold no lease, and have an empty queue. Prune instances unseen for more than 5 min. Persisted evidence is bounded by `HUB_INTAKE_LIMITS`.
- **mcp-hub churn (MCP-13):** persist only when the workflow meaningfully changed (phase, events, receipts, queue). A `lastSeenAt`-only change does not bump `revision` or write the file; flush it at most every 30 s.

### 3.5 Hub security (MCP-01, MCP-02, MCP-16)

Helpers (exported now): `isLoopbackHostname`, `isLoopbackOrigin`, `normalizeOriginPattern`, `parseAllowedOrigins`, `isOriginAllowed(origin, allowlist)`, `isHostHeaderAllowed(host, port, extraHosts?)`, `safeDecodePathSegments(pathname)`, `isJsonContentType(value)`, `ALLOWED_ORIGINS_ENV = 'VIBE_CHECK_ALLOWED_ORIGINS'`, `HUB_ERROR_CODES`, `interface HubErrorBody { error: string; code: HubErrorCode; hint?: string }`.

Allowlist patterns: `scheme://host[:port]`, `scheme://*.domain[:port]` (subdomains only, not the bare domain), `scheme://host:*`. Default ports are normalized. Loopback (`localhost`, `*.localhost`, `127.0.0.0/8`, `[::1]`, http or https, any port) is always allowed. The literal `null` origin is never allowed.

**mcp-hub request gate, in order, on every request:**
1. Host header: `isHostHeaderAllowed(req.headers.host, <bound port>, allowedHosts ∪ [<bound host> when it is not loopback]>)`. Otherwise → 403 `host-not-allowed` (this blocks DNS rebinding on `/api` and `/internal`).
2. `/internal/*`: any `Origin` header → 403 (existing behaviour; keep it).
3. `/api/*` with an `Origin` header that `isOriginAllowed` rejects → 403 `origin-not-allowed`, with hint `Start the hub with --allow-origin <origin> or set VIBE_CHECK_ALLOWED_ORIGINS.` and no CORS headers. Call `onBlockedOrigin(origin)` once per origin, so mcp-cli can print it. "Seen" origins are surfaced for a human to approve and are **never** trusted automatically; a self-reported `envelope.origin` is not a trust signal. A missing `Origin` is allowed (curl, `stats`, server clients).
4. CORS for allowed origins: `Access-Control-Allow-Origin: <request origin>` (never `*`), `Vary: Origin`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Max-Age: 600`. A preflight carrying `Access-Control-Request-Private-Network: true` also gets `Access-Control-Allow-Private-Network: true`. Disallowed preflight → 403 without CORS.
5. Path segments via `safeDecodePathSegments`; `null` → 400 `bad-request`.
6. Every POST (`/api` and `/internal`) requires `isJsonContentType(content-type)` → else 415 `unsupported-media-type`.
7. Body over `HUB_MAX_BODY_BYTES` → 413. JSON `SyntaxError` → 400 `invalid-json`. Anything else thrown → 500 `internal-error`, logged to stderr. The handler is fully wrapped: no unhandled rejection can kill the process.
8. Dispatch accepts only an issue present in the project's latest snapshot or tracked workflow (by id, or by stable key for that pageUrl), and **queues the hub's stored copy**, not the request body → otherwise 409 `invalid-issue`.
9. The browser `/verify` route stays lease-free (a user action) but is origin-gated.

`HubServerOptions` additions (mcp-hub defines them; mcp-cli passes them): `allowedOrigins?: readonly string[]`, `allowedHosts?: readonly string[]`, `onBlockedOrigin?: (origin: string) => void`. The hub also allows origins listed in registry entries (`ProjectRegistryEntry.origins`, §3.11). It re-reads the registry at most every 5 s, and only when an unknown origin arrives. Invert the tests that assert ACAO `*` (`hubServer.test.ts:191,197`).

**Core compatibility (core-engine, no change needed beyond §3.9):**
- The beacon's fetch already sends `Content-Type: application/json`, so it passes the content-type rule and triggers a CORS preflight that the hub answers.
- The `sendBeacon` fallback (used only when `fetch` is undefined) keeps `new Blob([payload], { type: 'application/json' })`. It is therefore preflighted too. A browser that refuses non-safelisted sendBeacon types reports `lastOk = false` / `lastError: 'rejected'`; acceptable, since every browser the widget supports has `fetch`.
- The widget's status/workflow/impact GETs and its `verify`/`dispatch` POSTs (`application/json`) carry `Origin` and pass for loopback dev servers.
- Breaking for users on custom dev hosts (`*.test`, LAN IPs, Docker hostnames): they must allow their origin. CHANGELOG "Breaking".

### 3.6 Dispatch and lease semantics (MCP-04, MCP-05, E2E-02, E2E-03, E2E-04, E2E-05, MCP-15, E2E-12)

**States** (`ProjectStatus.state`, `AGENT_CONNECTION_STATES = ['no-agent','watching','busy','stale','leased']`, new values appended):
- `no-agent`: no live lease. `stale`: heartbeat older than 10 s (existing).
- `watching`: a `watch_for_issue` long-poll is open, or one ended without a dispatch less than `WATCH_GRACE_MS` (5 s) ago. `ProjectStatus.waiting` is `true` only while the poll is open.
- `busy`: the owner received a dispatch and has not polled again.
- `leased`: the lease is held otherwise (claimed by watch_performance / acknowledge / resolve, or a poll ended more than 5 s ago).

```ts
interface LeaseHolder { clientName: string | null; acquiredAt; heartbeatAt; expiresAt; state: AgentConnectionState }
interface ProjectStatus { /* existing */ waiting?: boolean; inFlightDepth?: number; holder?: LeaseHolder | null }
DISPATCHABLE_AGENT_STATES = ['watching','leased','busy']; isDispatchableAgentState(state)
DISPATCH_RESULT_CODES: existing + 'queued' (ok:true, nobody waiting) + 'origin-not-allowed'
interface DispatchIssueResponse { /* existing */ deliveryId?: string }
interface QueuedIssue { /* existing */ deliveryId?: string; attempts?: number }   // 0.4 hubs always set them
interface DeliveryReceiptRequest { sessionId; deliveryId }
DELIVERY_RECEIPT_CODES = ['delivered','requeued','unknown-delivery','lease-conflict']
interface DeliveryReceiptResult { ok; code; projectId; deliveryId }
interface LeaseRequest { sessionId; clientName?: string }
LeaseResult failure: + holder?: LeaseHolder, message?: string
IssueWorkflowEvent['type']: + 'dispatch-dropped'
LEASE_EXPIRE_MS = 15_000; WATCH_GRACE_MS = 5_000; DELIVERY_ACK_TIMEOUT_MS = 15_000; MAX_WATCH_WAIT_SECONDS = 55
formatLeaseConflictMessage(projectId, holder?, now?): string; agentClientLabel(clientName): string | null
```

**Dispatch** (`POST /api/projects/:id/dispatch`, mcp-hub):
- `!isDispatchableAgentState(state)` → 409 `agent-not-watching`.
- Issue not known → 409 `invalid-issue` (§3.5 rule 8).
- Queue + in-flight ≥ 10 → 429 `queue-full`.
- Otherwise enqueue `{ deliveryId: randomUUID(), attempts: 0 }`, set phase `'sent'` with a `'sent'` event and an impact baseline. If an open waiter exists that belongs to the lease owner (check `!res.destroyed && !res.writableEnded`), hand it off now → 200 `dispatched`. Otherwise → 200 `queued`. Both responses include `deliveryId`.
- Hand-off tries **every** waiter for the project, not just the first. It moves the item to in-flight `{ sessionId, deadline: now + DELIVERY_ACK_TIMEOUT_MS, attempts + 1 }` and responds with the `QueuedIssue`.

**Receipts:**
- `POST /internal/projects/:id/deliveries/:deliveryId/ack` (body `DeliveryReceiptRequest`) → `delivered`: phase `'working'`, `'working'` event, lease `busy`.
- `.../nack` → `requeued`: back to the front of the queue.
- Unknown id → 404 `unknown-delivery`; another session → 409 `lease-conflict`.
- Past the deadline → re-queue at the front (on a timer or lazily).

**Bridge** (mcpServer/hubClient, mcp-hub):
- Pass `extra.signal` into every long-poll fetch (`waitForIssue`, `waitForSnapshot`), so a cancelled or timed-out tool call closes its HTTP request and the hub drops the waiter.
- Clamp each long-poll to `MAX_WATCH_WAIT_SECONDS`.
- On an item: if `extra.signal.aborted` → nack. Otherwise ack, then return the result. If the ack fails, return an isError result ("This delivery expired before it reached you. Call watch_for_issue again; the issue is still queued.").
- Watch timeout: isError `{ error: 'No issue was sent in the last N second(s). Call watch_for_issue again to keep waiting.', code: 'watch-timeout', projectId, retry: true }`, with correct pluralization (E2E-16).

**Release / exit / expiry / restart:**
- Releasing never clears the queue. That session's in-flight items return to the front of the queue. The next owner's first watch receives them.
- Registered projects persist queue + in-flight (as queued) in `.vibecheck/state.json` (hub-owned format; an optional top-level field keeps `schemaVersion: 1` readable).
- On load, a tracked issue in phase `'sent'` with no persisted dispatch (state written by 0.3) → phase `'detected'` + a `'dispatch-dropped'` event.
- Unregistered projects keep the queue in memory only; their workflow is not persisted either, so no stale `'sent'` survives a restart.

**Ownership (E2E-05):**
- Internal acknowledge/resolve require a `{ sessionId }` body.
- The `acknowledge_issue` and `resolve_issue` tools first call `leases.acquire(projectId)` (`claimsLease: true` in the catalog).
- The hub answers 409 `IssueActionResult { code: 'lease-conflict', holder }` when another live session holds the lease.

**Lease conflict (MCP-15, E2E-12):**
- A 409 from acquire returns `LeaseResult { ok: false, code: 'lease-conflict', projectId, holder, message: formatLeaseConflictMessage(projectId, holder) }`. `hubClient.acquireLease` returns it instead of throwing.
- The tool result is isError `{ error: message, code: 'lease-conflict', projectId, holder, retry: false }`.
- The bridge sends `clientName` from `server.server.getClientVersion()?.name`.

**hubClient interface** (mcp-hub; doctor in mcp-cli keeps using `health` / `listProjects` / `getProjectStatus`):

```ts
acquireLease(projectId, sessionId, clientName?): Promise<LeaseResult>            // 409 → resolved LeaseResult
waitForIssue(projectId, sessionId, timeoutSeconds, signal?: AbortSignal): Promise<QueuedIssue | null>
waitForSnapshot(projectId, sessionId, timeoutSeconds, signal?: AbortSignal): Promise<VibeSnapshot | null>
confirmDelivery(projectId, sessionId, deliveryId): Promise<DeliveryReceiptResult>
returnDelivery(projectId, sessionId, deliveryId): Promise<DeliveryReceiptResult>
acknowledgeIssue(projectId, sessionId, issueId): Promise<IssueActionResult>
resolveIssue(projectId, sessionId, issueId): Promise<IssueActionResult>
getVerificationStatus(projectId, issueId): Promise<IssueVerificationStatus | null>
```

**Doctor (mcp-cli):** `watching` → pass; `busy` → pass ("working"); `leased` → warn: "An agent session claimed <project> but is not waiting. Ask it to call watch_for_issue again." Use `formatLeaseConflictMessage` for conflict text. The current `else` branch would misreport `leased` as "No agent is watching".

### 3.7 MCP tool catalog (SITE-04, SITE-06, spec §6)

```ts
MCP_TOOL_NAMES = ['list_projects','get_project_impact','get_performance_snapshot','get_detected_issues',
  'get_fix_suggestions','watch_performance','watch_for_issue','acknowledge_issue','resolve_issue','release_project']
type McpToolParam = { name; required; description } & ({ kind: 'string' } | { kind: 'number'; min; max; default } | { kind: 'enum'; values })
interface McpToolDescriptor { name: McpToolName; description: string; params: readonly McpToolParam[]; claimsLease: boolean }
MCP_TOOL_CATALOG: readonly McpToolDescriptor[]; getMcpToolDescriptor(name)
```

- `resolve_issue` description: exactly `Request browser-evidence verification after fixing an issue in one project`. It gains `wait_seconds` (number 0–55, default 0).
- `watch_*` `timeout_seconds` stays 1–300, default 30 (compatible). One call waits at most 55 s.
- **mcp-hub registers all ten tools by iterating the catalog.** Name and description are used verbatim, and each zod schema is built from `params` (string → `z.string()`, `.optional()` unless required; number → `z.number().min().max().default()`; enum → `z.enum(values)`; `.describe(description)` on each). Add a test that the registered names and descriptions deep-equal the catalog.
- release-docs syncs the tool lists in CLAUDE.md, AGENTS.md and SKILL.md with the catalog wording and the new result shapes (§3.3 items 13–15, §3.6). The `/.well-known/mcp.json` generator is site phase.

### 3.8 Engine API and core exports (SPEC-P1, SPEC-P2, C15, C26)

**core-engine**, `packages/core/src/engine.ts`:

```ts
export interface VibeEngine {
  start(): void; stop(): void; getSnapshot(): VibeSnapshot; getIssues(): readonly VibeIssue[]
  clearIssues(detector?: DetectorName): void            // was clearIssues(): void (compatible)
  onSnapshot(cb): () => void; isRunning(): boolean; getBeaconStatus(): BeaconStatus | null
  dispatchIssue(issue: VibeIssue): Promise<DispatchIssueResponse>
  recheck?(detector: DetectorName): Promise<void>       // optional: createScriptedEngine stays valid
  getAuditRun?(detector: AuditDetectorName): AuditRun | null
}
```

**core-detectors**, factory options and the probe util (SPEC-P1):

```ts
// packages/core/src/utils/probe.ts
export const VC_PROBE = Symbol.for('vibecheck.probe')
export interface ProbeResult { readonly ok: boolean; readonly status: number | null; readonly contentType: string; readonly body: string; readonly networkError: boolean }
export type ProbeCache = Map<string, Promise<ProbeResult>>            // key: method + url + accept
export const createProbeCache = (): ProbeCache => ...
export const probeFetch = (url: string, init?: RequestInit, cache?: ProbeCache): Promise<ProbeResult> => ...  // fetch(url, { ...init, [VC_PROBE]: true })
// detectors
export interface AuditDetectorOptions { readonly probeCache?: ProbeCache }
createSeoDetector(options?: AuditDetectorOptions); createAeoDetector(options?); createWebEssentialsDetector(options?)
```

- duplicate-requests ignores calls whose `init?.[VC_PROBE] === true`.
- One cache per audit batch, so `/robots.txt` is fetched once per run. Spec tests: an engine with every detector enabled reports no `duplicate-requests` issue after the audits settle.

**core-engine re-exports.** React imports only from core, so these must be added to `packages/core/src/types.ts` and `index.ts`:
- Runtime: `getHubStartCommand`, `getDoctorCommand`, `DEFAULT_HUB_URL`, `DEFAULT_HUB_PORT`, `HUB_URL_ENV`, `normalizeHubUrl`, `hubPortFromUrl`, `isDispatchableAgentState`, `DISPATCHABLE_AGENT_STATES`, `formatLeaseConflictMessage`, `agentClientLabel`, `MCP_PACKAGE_NAME`, `WIDGET_PACKAGE_NAME`, `MCP_PACKAGE_VERSION`, `MCP_TOOL_CATALOG`, `MCP_TOOL_NAMES`, `getMcpToolDescriptor`, `classifyVerificationSnapshot`, `issueLastSeenAt`, `getIssueIdentity`, `PAYLOAD_LIMITS`, `boundIssue`, `boundSnapshot`, `fitEnvelopeToBytes`, `AUDIT_DETECTORS`, `DETECTOR_KINDS`, `VERIFICATION_OUTCOMES`, `ISSUE_ACTION_CODES`.
- Types: `DetectorKind`, `DetectorRunStatus`, `AuditRun`, `AuditRunStatus`, `AuditDetectorName`, `SnapshotTruncation`, `LeaseHolder`, `LeaseRequest`, `IssueActionResult`, `IssueActionCode`, `IssueVerificationStatus`, `VerificationOutcome`, `VerificationEvidence`, `VerificationInconclusiveReason`, `DeliveryReceiptRequest`, `DeliveryReceiptResult`, `DeliveryReceiptCode`, `AgentClientSetupOptions`, `HubStartCommandOptions`, `McpToolDescriptor`, `McpToolName`, `McpToolParam`, `PayloadLimits`.
- core-detectors' new exports: `probeFetch`, `createProbeCache`, `VC_PROBE`, `ProbeResult`, `ProbeCache`, `AuditDetectorOptions`. core-engine adds the export lines once `utils/probe.ts` exists; the integrator checks this.
- All of these are bundled protocol code, so core's zero-runtime-deps rule holds.

**DOM count (C26):** `domNodeCount` excludes elements inside `[data-wcgw]` subtrees, including the roots themselves. react-widget guarantees that every element the widget renders (pill, panel, annotation layer, any portal container from W16) sits under an element carrying `data-wcgw`. core-detectors' domBloat depth walk skips those subtrees.

### 3.9 BeaconStatus additions (core-engine → react-widget)

```ts
export type BeaconFailure = 'hub-offline' | 'payload-too-large' | 'rejected' | 'origin-not-allowed'
export interface BeaconStatus {        // existing fields unchanged (statusError stays for compatibility)
  readonly lastError?: BeaconFailure | null   // null after success or before the first answer
  readonly retryAt?: number | null            // next attempt while backing off
}
```

Backoff (C17): after consecutive failures the interval goes 2 → 4 → 8 → 16 → 30 → 60 s (cap), with one status probe per attempt while offline. Reset on success, and on `visibilitychange` to visible. No routine sends while `document.hidden`. No extra `refreshStatus` after each successful POST (C6).

### 3.10 Widget display obligations (react-widget)

1. `getAgentDisplayState`:
   - `'leased'` → a new display state, e.g. `'claimed'` (amber). Copy: "An agent claimed this project but isn't waiting right now. Send to agent queues the issue until it watches again."
   - `'watching'` → connected; `'busy'` → working.
   - `'checking'` while `lastOk === null && projectStatus === null` (W8).
   - `lastError` `origin-not-allowed` / `payload-too-large` / `rejected` → distinct, accurate states, never "hub offline".
2. Send is enabled iff `lastOk === true && isDispatchableAgentState(projectStatus?.state)`.
3. Dispatch result `queued` → "queued for agent" (never "sent"). `dispatched` → "sent to agent". Phase labels: `'sent'` → "Queued for agent" / vibe "Waiting for your AI to pick it up"; `'working'` → "With agent". Copy honesty: a queued issue is not delivered.
4. Setup pack and snippets carry `beaconUrl` and `hubRunning` (§3.2).
5. `IssueProgress` `EVENT_LABELS` gains `'dispatch-dropped'` ("Send dropped: no agent received it"). Without it the package does not type-check (expected, §4).
6. Verification: `engine.recheck?.()` on new requests (§3.3 item 10). Optionally show `waitingFor` in plain language.
7. SPEC-P4 / W4: with no hub configured (`!beaconUrl || !projectId`), the resolve button reads **"dismiss"** in both modes. Title: "Hide this issue. Without a hub, nothing gets verified." It calls local `markResolved`. With a hub configured but unreachable, "check this fix" is disabled with a visible reason. Always await `requestVerification` and surface its errors (no unhandled rejection).
8. Conflict copy uses `formatLeaseConflictMessage(projectId, projectStatus.holder)`.
9. Info-level findings still count toward the problem count and health (Radu's ruling; do not change).
10. Record every testid or visible-label change that `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts` asserts as a handoff to mcp-hub, which owns e2e. Current asserts: 'Waiting for', 'Need to add the MCP server?', /codex mcp add vibe-check/, `project_id "…"`, /copy codex setup/i, plus the send/verify flows.

### 3.11 CLI ↔ hub configuration (mcp-cli → mcp-hub)

- Flags: `hub|up --allow-origin <origin>` (repeatable), `--allow-host <host[:port]>` (repeatable). Env: `VIBE_CHECK_ALLOWED_ORIGINS` (`parseAllowedOrigins`). Pass them as `createHubServer({ ..., allowedOrigins, allowedHosts, onBlockedOrigin })`. `onBlockedOrigin` prints once: `[vibe-check] Blocked a browser request from <origin>. If this is your app, restart the hub with --allow-origin <origin>.`
- `ProjectRegistryEntry` gains `origins?: readonly string[]` (normalized patterns), via `register --origin <origin>` (repeatable) and `setup --origin`. Also `register --force` and `unregister --project`. Registry maps use `Object.create(null)` or `Map` with `Object.hasOwn` checks.
- Warn at start when `VIBE_CHECK_HOST` is not loopback.
- `setup --port <n>` writes `beaconUrl: http://127.0.0.1:<n>` into the generated component (default `DEFAULT_HUB_URL`). Agent commands include the hub env when the port is not the default (same strings as §3.2).

---

## 4. Known temporary breakages (expected after the foundation landed)

| Package | Breakage | Owner fix |
|---|---|---|
| react lint | `src/panels/IssueProgress.tsx:28` — `Record<IssueWorkflowEvent['type'], string>` is missing `'dispatch-dropped'` | react-widget, §3.10 item 5 |
| react test | `src/panels/__tests__/AgentConnectionStatus.test.tsx:93` asserts `@0.3.0 hub` | react-widget: assert against `HUB_START_COMMAND` from core |
| mcp test | `src/__tests__/doctor.test.ts:82,139` assert `@0.3.0` | mcp-cli: use `HUB_START_COMMAND` / `MCP_PACKAGE_SPEC` |
| tooling test | `scripts/__tests__/version-sync.test.ts` › "print the exact pinned commands in the primary docs" (README.md, packages/mcp/README.md still pin `@0.3.0`) | release-docs (root README) + mcp-cli (mcp README); it goes green when both pin `@0.4.0` exactly as the protocol prints |
| core | none: core lint and 350 tests pass against the new protocol | — |
| mcp/react lint (new code) | Code written against §3.8/§3.9 core exports fails to type-check until core-engine lands them | Integrator order: core-engine first, then react-widget |

`setup.test.ts` / `main.test.ts` pass `'0.3.0'` as explicit inputs and still pass. Updating them to the real version is optional (mcp-cli).

---

## 5. Integration order and checks

1. core-engine and core-detectors (core exports §3.8 must exist before react-widget's code type-checks).
2. mcp-hub and mcp-cli (shared `packages/mcp`: `lib.ts` exports belong to mcp-hub; mcp-cli hands off new exports).
3. react-widget.
4. release-docs. The integrator then runs, in order: `pnpm --filter @wcgw/vibe-check-protocol build`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm --filter @wcgw/vibe-check size`, `pnpm test:e2e:mcp`, `pnpm test:clients`, `pnpm gen:docs` (if core-detectors has not), `node packages/protocol/scripts/gen-version.mjs --check`, `pnpm release:validate -- 0.4.0`.
5. CHANGELOG `## 0.4.0`, assembled from every report's bullets. Include these "Breaking" items: the origin allowlist, the JSON-only POSTs, acknowledge/resolve claiming the lease, and verification waiting for settled detectors. Add "upgrade the widget and the MCP package together".

## 6. Foundation CHANGELOG bullets

- All packages move to 0.4.0 together. The setup commands the widget, `setup` and the docs print now pin `@wcgw/vibe-check-mcp@0.4.0`, which includes the guided `up` command. Update any MCP config that still pins `@0.3.0`.
- The pinned MCP version is now generated from the MCP package version at build time, so setup commands cannot point at a version that does not exist.
- Setup commands can carry a non-default hub port: the agent config gets `VIBE_CHECK_HUB_URL`, `up`/`hub` get `--port`, and `doctor` gets `--hub-url`.
- The setup pack no longer tells you to start a second hub when one is already running, and it ends with a read-only `doctor` check.

## 7. Risks

- `[UNVERIFIED]` CLI env-flag syntax (§3.2): checked against local `--help` output, not executed; run `pnpm test:clients`.
- Mixed versions: a 0.3 widget talking to a 0.4 hub sees `leased` as "waiting for an agent" and a `queued` dispatch as "sent". A 0.4 hub treats 0.3 snapshots as legacy evidence (30 s delay, `estimated` receipts). Document "upgrade together".
- The origin allowlist will refuse custom dev hosts until users pass `--allow-origin`; the hint text must say so plainly.
- `version.generated.ts` is committed source written by a script. The protocol build regenerates it, protocol tests and version-sync catch drift, and REL-2 should add `--check` to `release:validate`.
- The verification rule depends on core-detectors refreshing `lastSeenAt` for state detectors (§3.3 item 2). Otherwise a still-present state issue looks like a stale latch and verification waits instead of failing. mcp-hub's tests should cover this with fixtures that model 0.4 producers.
