# Step 1 status — package fixes

Written 2026-10-30 by Cursor handoff agent after reading `handoff/README.md` and
assessing the working tree against `handoff/package-contract.md`.

## Method

- `handoff/impl/` contained only `foundation.md` (six owner reports missing).
- Per handoff Step 1: treated missing reports as possibly partial work; used
  `git diff` / new-file presence against contract §1 globs, then checked §2
  blockers and §3 APIs in source.
- Branch: `widget/retire-proof-branding` (as required). No commit/push yet
  (consent gate).

## Owner reports

| Owner | Report | Working-tree signal |
|---|---|---|
| foundation | `foundation.md` | Done (protocol + 0.4.0 versions). Protocol tests 70/70 green. |
| core-engine | **missing** | Large partial diff (~1.4k insertions): engine `recheck`/`clearIssues`/`getAuditRun`/`engineStartedAt`/`boundSnapshot`, beacon bounding, FPS/INP, tsup. |
| core-detectors | **missing** | Large partial: `probe.ts`, `issueBook`, `auditRunner`, `runStatus`, many detectors; **getStatus missing** on heavy-library / large-images / resource-bloat / unoptimized-images (audits ok via `createAuditDetector`). |
| mcp-hub | **missing** | **Partial and currently broken:** hubStore/workflow/schema/persistence updated; **`hubServer.ts`, `mcpServer.ts`, `hubClient.ts`, `leaseManager.ts` and their tests are UNCHANGED vs HEAD** and do not type-check against the new hubStore. |
| mcp-cli | **missing** | Large partial: cli/main/setup/doctor/registry + tests; `--allow-origin` present. |
| react-widget | **missing** | Partial: dismiss, leased label, polling/portal helpers, SSR test file; README still `@0.3.0`; no `'use client'` banner found. |
| release-docs | **missing** | Partial: CI/release scripts, vitest root config, SKILL/README pins to 0.4.0; **no CHANGELOG `## 0.4.0`**; mcp/react package READMEs still 0.3.0. |

## Blocker proofs (handoff Step 1.2) — current

| Proof | Status |
|---|---|
| **MCP-01** evil Origin / Host rebinding / no ACAO `*` | **OPEN.** `hubServer.ts` still hard-codes `Access-Control-Allow-Origin: *`; tests still assert `*`. main.ts already passes allowlist options that hubServer ignores. |
| **MCP-02** `GET /%` → 400, hub stays up | **OPEN.** Path still `decodeURIComponent` outside a safe decode (line ~242). |
| **C1** reload-without-fix does not verify; HMR does (C4) | **UNPROVEN.** Protocol classifier + workflow hooks exist; end-to-end proof not run (hubServer broken). |
| **C2** heavy page stays under 64 KB / beacon alive | **PARTIAL.** `fitEnvelopeToBytes` wired in beacon; need live proof. |
| **C3** SEO/AEO probes do not create duplicate-requests | **PARTIAL.** `probeFetch` + `VC_PROBE` exist; **not exported** from `packages/core/src/index.ts` yet (contract §3.8). |
| **Version** no `vibe-check-mcp@0.3.0` outside CHANGELOG/handoff | **Package docs/setup done.** Remaining hits are intentional negative fixtures in `scripts/__tests__/release-readiness.test.ts` (assert the validator rejects stale pins) and `apps/web/**` (site phase). |
| **E2E-02/03, MCP-04/05** queue survives; leased vs watching | **PARTIAL in hubStore** (queue/inFlight/handOff/confirmDelivery/`leased` state). **Not wired** through hubServer/mcpServer/hubClient. |

## Gate snapshot

- `pnpm --filter @wcgw/vibe-check-protocol test` → pass (70).
- `pnpm --filter @wcgw/vibe-check-core test` → **3 fail** in `memoryLeak.test.ts`.
- `pnpm --filter @wcgw/vibe-check-mcp exec tsc -p tsconfig.lint.json` → **fails** (hubServer vs hubStore API mismatch + hubStore `never` narrowing on expired lease).
- CHANGELOG: latest section is `## 0.3.0` only.

## Progress this session

| Item | Status |
|---|---|
| hubServer rewrite (§3.5/§3.6) | **Done.** Tests 12/12. |
| hubClient + mcpServer + leaseManager | **Done.** Catalog registration, wait_seconds, abort+ack/nack. |
| hubStore lease narrowing | **Done.** |
| mcp package tests | **207/207 green.** |
| MCP-01 proof | hubServer tests: evil Origin → 403 + no ACAO; Host rebinding via raw HTTP → 403; ACAO echoes origin never `*`. |
| MCP-02 proof | hubServer test: `GET /%` → 400, `/api/health` still 200. |
| probeFetch export (§3.8) | **Done** (`packages/core/src/index.ts`). |
| memoryLeak tests vs new floor heuristic | **Done** (11/11). |
| packages/{mcp,react}/README `@0.3.0` → `@0.4.0` | **Done.** |
| core getStatus on image/resource/heavy detectors | **Done** (resource-bloat, large-images, unoptimized-images, heavy-library). Audits already via auditRunner. |
| core package tests | **391/391 green** (earlier); detector getStatus patches pending re-run in next gate. |
| CHANGELOG `## 0.4.0` | **Drafted** (New / Fixed / Security / Breaking). Integrator may refine from owner bullets. |
| Full Step 1 gate | **In progress** (package builds + tests). |

## Immediate work order (remaining)

1. Finish full Step 1 gate; record remaining proofs (C1–C3, version grep outside apps/web).
2. Remaining react-widget items (P4 use client, etc.) as needed for gate green.
3. **Awaiting Radu consent** before commit / push / PR.

## Consent

Per handoff guardrails: no `git commit`, `git push`, `gh pr create`, publish, or deploy without Radu’s explicit go-ahead.

**Ask now:** May I commit the in-progress 0.4.0 package-fix work on `widget/retire-proof-branding` (hub security + bridge + test updates + probe export + README pins)? Push/PR still wait for a separate go-ahead unless you approve those too.
