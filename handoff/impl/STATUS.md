# Step 1 status — package fixes

Updated 2026-10-30 after PR #10 merged into `widget/retire-proof-branding` and
the Step 1 gate was re-run on `cursor/vibe-check-040-step1-gate-1f8b`.

## Gate

```bash
pnpm build && pnpm lint && pnpm test \
  && pnpm --filter @wcgw/vibe-check size \
  && pnpm test:e2e:mcp && pnpm test:clients \
  && pnpm release:validate -- 0.4.0 && pnpm release:check-packages
```

| Command | Result |
|---|---|
| `pnpm build` | pass (protocol, core, mcp, react, demo, apps/web) |
| `pnpm lint` | pass (4 packages) |
| `pnpm test` | pass (tooling 79, protocol 70, core 391, mcp 207, react 92, apps/web 36) |
| `pnpm --filter @wcgw/vibe-check size` | pass (38.5 KB gzip / 45 KB budget) |
| `pnpm test:e2e:mcp` | pass (7/7) |
| `pnpm test:clients` | pass (Codex, Claude Code, Cursor) |
| `pnpm release:validate -- 0.4.0` | pass (pins in 20 documents + CHANGELOG + generated version) |
| `pnpm release:check-packages` | pass (core, mcp, react tarballs) |
| `pnpm publish:dry` | **renamed** — use `release:check-packages` (assertive) or `pnpm -r --filter './packages/{core,mcp,react}' publish --no-git-checks --dry-run --ignore-scripts` |

`apps/web` copy tests that assert the old press/proof landing are still deferred
to Step 2; current `apps/web` vitest suite is green on this branch.

## Blocker proofs (handoff Step 1.2)

| Proof | Status | Evidence |
|---|---|---|
| **MCP-01** evil Origin / Host rebinding / no ACAO `*` | **PASS** | `packages/mcp/src/__tests__/hubServer.test.ts` — evil Origin → 403; Host rebinding via raw HTTP → 403; ACAO echoes origin never `*` |
| **MCP-02** `GET /%` → 400, hub stays up | **PASS** | same file — malformed path → 400, `/api/health` still 200 |
| **C1** reload-without-fix does not verify; HMR does (C4) | **PASS** | `packages/protocol/src/__tests__/verification.test.ts` — evaluation-before-request / stale-issue inconclusive; settled post-request absence → clean; e2e `persists a verified fix and reopens its regression` |
| **C2** heavy page stays under 64 KB / beacon alive | **PASS** | `packages/core/src/beacon/__tests__/beaconClient.test.ts` — `fitEnvelopeToBytes` + keepalive path |
| **C3** SEO/AEO probes do not create duplicate-requests | **PASS** | `probeFetch` / `VC_PROBE` exported from core; `duplicateRequests` ignores `isProbeInit`; audits use `probeFetch` via `auditRunner` |
| **Version** no stale `@0.3.0` pins outside CHANGELOG/handoff | **PASS** | `release:validate -- 0.4.0`; remaining `@0.3.0` hits are intentional fixtures in `scripts/__tests__/release-readiness.test.ts` and deferred `apps/web` site copy |
| **E2E-02/03, MCP-04/05** queue survives; leased vs watching | **PASS** | hubServer tests assert `leased` when claimed but not waiting; e2e isolates projects / second watcher / handoff; two-phase delivery in hubClient/mcpServer |

## This slice (post-merge)

- Restored mangled MCP/react README pins (`/vibe-check-mcp.4.0` → `@wcgw/vibe-check-mcp@0.4.0`)
- Wired `usePortalHost` + `createPortal` so SSR/hydration paint nothing until mount (W1/P5)
- Added `'use client'` banner + disabled treeshake (P4/P13); pack check asserts the directive
- Absolute screenshot URLs in react README; removed commented duplicates (P14)
- Next.js App Router README guidance
- IssueActions dismiss vs verify-fix; tests + e2e aligned to `resolve_issue` `code: 'verifying'`

## Remaining before Step 1 "done when"

- Owner reports in `handoff/impl/<owner>.md` are still missing (work landed in tree; STATUS is the integrator record)
- Live browser proof of C2/C3 on a deliberately heavy page is not re-run here; unit + e2e cover the contracts
- Site Step 2 still owns press/proof landing copy and remaining `apps/web` pin/docs findings
