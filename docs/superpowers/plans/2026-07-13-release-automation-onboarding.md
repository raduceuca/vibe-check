# Release Automation and Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate safe releases and production checks, add a tested one-command React/agent scaffold, remove deployment warnings, and publish a real widget-to-agent recording.

**Architecture:** Root ESM tooling owns release validation, resumable publishing, and production HTTP checks; GitHub workflows are thin orchestrators around those tested scripts. The MCP package owns the setup CLI with injected filesystem/process dependencies. The existing packed E2E fixture remains the only source for the committed demo recording.

**Tech Stack:** TypeScript 5.9, Node.js ESM, Vitest 4, pnpm 10, GitHub Actions, npm OIDC trusted publishing, Next.js 16, OpenNext, Wrangler 4, Playwright 1.61, ffmpeg.

## Global Constraints

- TypeScript strict mode with no `any` and named arrow exports only.
- Preserve immutable inputs and existing user configuration.
- Core retains zero runtime dependencies; React retains React 18+ peer support.
- The setup command supports only React projects and never guesses an app entrypoint rewrite.
- The release workflow runs only from `main`, creates the tag last, and is safe to rerun after partial npm publication.
- No package version bump or npm publish occurs while implementing this plan.
- UI remains inline styles in the React package; site presentation continues in `apps/web/app/global.css`.

---

### Task 1: Clean-clone test bootstrap and tooling test entrypoint

**Files:**
- Modify: `package.json`
- Create: `scripts/__tests__/release-tooling.test.ts`
- Create: `scripts/vitest.config.ts`

**Interfaces:**
- Produces: root scripts `test:tooling` and a `test` command that builds `@wcgw/vibe-check-protocol` before recursive package tests.
- Consumes: existing protocol `build` and package `test` scripts.

- [ ] **Step 1: Preserve the observed red result**

Run from a clean worktree without `packages/protocol/dist`:

```bash
pnpm test
```

Expected: React suites fail resolving `@wcgw/vibe-check-protocol`.

- [ ] **Step 2: Add the root tooling test runner and protocol bootstrap**

Update root scripts to include:

```json
{
  "test": "pnpm --filter @wcgw/vibe-check-protocol build && pnpm test:tooling && pnpm -r --filter '!@wcgw/vibe-check-mcp-roundtrip' test",
  "test:tooling": "vitest run --config scripts/vitest.config.ts"
}
```

Create `scripts/vitest.config.ts` with a Node environment and only
`scripts/__tests__/**/*.test.ts` included. Start the tooling test file with an
empty smoke suite so the command is executable before later tasks add cases.

- [ ] **Step 3: Verify green from a clean generated-output state**

```bash
pnpm clean
pnpm test
```

Expected: protocol builds first and all existing package suites plus the tooling smoke test pass.

- [ ] **Step 4: Commit**

```bash
git add package.json scripts
git commit -m "test: bootstrap protocol in clean workspaces"
```

### Task 2: Production smoke checker and scheduled workflow

**Files:**
- Create: `scripts/production-smoke.mjs`
- Modify: `scripts/__tests__/release-tooling.test.ts`
- Modify: `package.json`
- Create: `.github/workflows/production-smoke.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: `runProductionSmoke({ origin, fetchImpl, retries, retryDelayMs, sleep })`, `formatSmokeResults(results)`, and CLI `pnpm smoke:production -- [origin]`.
- Produces: scheduled workflow every 30 minutes and manual dispatch with an optional origin input.

- [ ] **Step 1: Write failing route and retry tests**

Add tests that inject a fake fetch and assert:

```ts
const results = await runProductionSmoke({
  origin: 'https://vibecheck.wcgw.fun',
  fetchImpl,
  retries: 2,
  retryDelayMs: 0,
  sleep: async () => undefined,
})
expect(results.every((result) => result.ok)).toBe(true)
```

Cover all six routes, wrong content type, missing canonical content, a transient
500 that passes on retry, and a persistent failure whose formatted output names
the route and reason.

- [ ] **Step 2: Verify red**

```bash
pnpm test:tooling
```

Expected: import failure for `production-smoke.mjs`.

- [ ] **Step 3: Implement the checker**

Define immutable route specs for `/`, `/docs/quickstart`, `/robots.txt`,
`/sitemap.xml`, `/llms.txt`, and `/opengraph-image`. Fetch with
`redirect: 'follow'`, validate status/content-type/body, retry only failed
checks, and return structured results without calling `process.exit` from the
exported function. The CLI prints one line per route and sets `process.exitCode`
when a check remains failed.

- [ ] **Step 4: Add the scheduled workflow and documentation**

The workflow uses Node 20, `workflow_dispatch`, and:

```yaml
schedule:
  - cron: "17,47 * * * *"
```

It runs `node scripts/production-smoke.mjs "${ORIGIN}"` and appends the output
to `$GITHUB_STEP_SUMMARY`. Document `pnpm smoke:production` in README
development commands.

- [ ] **Step 5: Verify green and live production**

```bash
pnpm test:tooling
pnpm smoke:production
```

Expected: unit tests pass and six production routes report PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts package.json .github/workflows/production-smoke.yml README.md
git commit -m "ci: monitor production routes"
```

### Task 3: Resumable release workflow

**Files:**
- Create: `scripts/release-manifest.mjs`
- Create: `scripts/publish-release.mjs`
- Modify: `scripts/__tests__/release-tooling.test.ts`
- Modify: `package.json`
- Create: `.github/workflows/release.yml`
- Create: `docs/releasing.md`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `readReleaseManifest(root)`, `validateReleaseVersion(manifest, expectedVersion)`, and `publishMissingPackages({ packages, packageExists, publishPackage, log })`.
- Produces: `pnpm release:validate -- <version>` and `pnpm release:publish -- <version>`.

- [ ] **Step 1: Write failing manifest/publish tests**

Add tests proving the manifest contains core, MCP, and React in dependency-safe
order; mismatched versions fail with every mismatched package; published
versions are skipped; missing versions publish once in order; and a publish
failure stops later packages.

- [ ] **Step 2: Verify red**

```bash
pnpm test:tooling
```

Expected: imports for release manifest and publisher do not exist.

- [ ] **Step 3: Implement tested release helpers**

Read exact versions from package JSON files. Query
`https://registry.npmjs.org/<encoded-name>/<version>` and treat 200 as present,
404 as missing, and other statuses as errors. Publish a missing package with:

```bash
pnpm --filter <package-name> publish --no-git-checks
```

Keep subprocess execution in the CLI boundary so unit tests use injected
functions.

- [ ] **Step 4: Add guarded GitHub release orchestration**

Create a `workflow_dispatch` input named `version`, a `production` environment,
`contents: write` and `id-token: write` permissions, and a non-canceling
`vibe-check-production-release` concurrency group. Use Node 24 without a package
manager cache, run install/full verification/publish/deploy, then verify or
create `v<version>` at `$GITHUB_SHA` and create the GitHub release last.

- [ ] **Step 5: Document one-time external configuration**

Document npm trusted publishers for all three public packages with workflow
filename `release.yml`, GitHub environment `production`, and publish permission.
Document required environment secrets `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`, plus the exact dispatch and retry behavior.

- [ ] **Step 6: Verify green and workflow syntax**

```bash
pnpm test:tooling
pnpm release:validate -- 0.2.0
pnpm test:tooling -- workflow
```

Add `yaml` as an explicit root dev dependency, parse both workflow files in the
tooling suite, and assert the expected triggers, permissions, environment,
concurrency, and jobs are present.

- [ ] **Step 7: Commit**

```bash
git add scripts package.json .github/workflows/release.yml docs/releasing.md
git commit -m "ci: automate resumable releases"
```

### Task 4: MCP setup scaffold

**Files:**
- Modify: `packages/mcp/src/cli.ts`
- Modify: `packages/mcp/src/main.ts`
- Modify: `packages/mcp/src/index.ts`
- Create: `packages/mcp/src/setup.ts`
- Create: `packages/mcp/src/__tests__/setup.test.ts`
- Modify: `packages/mcp/src/__tests__/cli.test.ts`
- Modify: `packages/mcp/src/__tests__/main.test.ts`
- Modify: `packages/mcp/src/lib.ts`
- Modify: `packages/mcp/README.md`
- Modify: `README.md`
- Modify: `apps/web/content/docs/quickstart.mdx`

**Interfaces:**
- Produces CLI config `{ role: 'setup', agent, projectId, dryRun, force }`.
- Produces `runSetup(options, dependencies): Promise<SetupResult>` and
  `renderDevtoolsComponent(projectId): string`.
- Consumes runtime package version from `__VIBE_CHECK_VERSION__`.

- [ ] **Step 1: Write failing CLI parser tests**

Assert parsing of:

```ts
parseCliConfig(['setup', '--agent', 'codex', '--project', 'storefront', '--dry-run'], {})
```

Reject missing/unknown agents, duplicate options, missing values, and unknown
flags. Update the usage assertion to include setup.

- [ ] **Step 2: Verify parser red, then implement parser green**

```bash
pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/cli.test.ts
```

Implement only setup option parsing and rerun until green.

- [ ] **Step 3: Write failing setup behavior tests**

Use temporary project directories and injected command execution to cover
package-manager detection, React validation, generated component content,
existing component refusal/force replacement, dry-run no-op, already-installed
widget skip, Codex/Claude command selection, Cursor merge preservation, invalid
Cursor JSON, and idempotent existing MCP configuration.

- [ ] **Step 4: Verify setup red, then implement setup green**

```bash
pnpm --filter @wcgw/vibe-check-mcp test -- src/__tests__/setup.test.ts
```

Implement focused helpers for package detection, component rendering, command
planning, JSON merge, and orchestration. Preserve all pre-existing Cursor
servers and use atomic write-then-rename for generated JSON/component files.

- [ ] **Step 5: Wire setup through main and the compiled CLI**

Pass cwd, version, filesystem, and runner dependencies to `runMain`; return an
exit result after setup; print actions and next steps to stdout; and keep hub and
connect as the only long-running roles. Add a main test using injected setup.

- [ ] **Step 6: Document the scaffold**

Lead quickstarts with:

```bash
npx -y @wcgw/vibe-check-mcp@0.2.0 setup --agent codex
```

Document all agents, `--project`, `--dry-run`, `--force`, the generated file,
the required one-line mount, and the hub/watch sequence.

- [ ] **Step 7: Verify package behavior and clean temporary install**

```bash
pnpm --filter @wcgw/vibe-check-mcp test
pnpm --filter @wcgw/vibe-check-mcp build
```

Pack the three public packages, run setup with `--dry-run` in a temporary React
project, then run it against an injected isolated fake client configuration.

- [ ] **Step 8: Commit**

```bash
git add packages/mcp README.md apps/web/content/docs/quickstart.mdx
git commit -m "feat(mcp): scaffold widget and agent setup"
```

### Task 5: Next routing and Cloudflare compatibility

**Files:**
- Delete: `apps/web/middleware.ts`
- Create: `apps/web/lib/markdown-rewrites.mjs`
- Create: `apps/web/__tests__/markdown-rewrites.test.ts`
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/web/package.json`
- Modify: `apps/web/wrangler.jsonc`

**Interfaces:**
- Produces immutable Next rewrite rules with unchanged Markdown negotiation behavior.

- [x] **Step 1: Add rewrite behavior tests before the migration**

Use `next/experimental/testing/server` to assert `/docs/quickstart.md` rewrites
to `/md/docs/quickstart`, an explicit `Accept: text/markdown` request rewrites,
ordinary HTML continues, and asset/API paths do not match the rules.

- [x] **Step 2: Verify red**

```bash
pnpm --filter web exec vitest run __tests__/markdown-rewrites.test.ts
```

Expected: the rewrite module is missing.

- [x] **Step 3: Move routing to rewrites and update compatibility date**

Remove middleware, express the same route negotiation as `next.config.mjs`
rewrites, and set `compatibility_date` to `2026-07-13`.

Implementation finding: a direct `proxy.ts` migration clears the Next warning
but makes `opennextjs-cloudflare build` fail because Next Proxy uses the Node.js
runtime and OpenNext does not support Node.js middleware. Configuration rewrites
avoid both incompatibilities.

- [x] **Step 4: Verify tests, local routes, builds, and warning removal**

```bash
pnpm --filter web test
pnpm --filter web build
pnpm --filter web cf:build
pnpm --filter web exec wrangler deploy --dry-run
```

Expected: rewrite tests and both builds pass, explicit and negotiated Markdown
requests return Markdown locally, and Next prints no middleware deprecation.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "chore(web): replace deprecated middleware with rewrites"
```

### Task 6: Real MCP demo recording and presentation

**Files:**
- Modify: `e2e/mcp-roundtrip/fixtures/src/App.tsx`
- Create: `e2e/mcp-roundtrip/demo-record.ts`
- Modify: `e2e/mcp-roundtrip/package.json`
- Modify: `package.json`
- Create: `apps/web/public/demo/vibe-check-agent-roundtrip.gif`
- Create: `apps/web/public/demo/vibe-check-agent-roundtrip-poster.png`
- Create: `apps/web/components/landing/RealAgentDemo.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/global.css`
- Modify: `README.md`
- Modify: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts`

**Interfaces:**
- Produces `pnpm demo:record` and a recording-only fixture event named
  `vibe-check-demo-agent-received`.
- Consumes existing packed install helper, hub process helper, MCP SDK client,
  and widget test IDs.

- [ ] **Step 1: Add recording-mode fixture assertions**

Extend the packed E2E spec to load `?recording=1`, assert the recording shell is
visible, dispatch `vibe-check-demo-agent-received` only after the real MCP result
returns, and assert the shell displays the detector/project receipt.

- [ ] **Step 2: Verify red**

```bash
pnpm test:e2e:mcp
```

Expected: the recording shell test ID is absent.

- [ ] **Step 3: Implement the recording presentation**

Render a clean split presentation only for `recording=1`: project status and
instructions on the left, the real VibeCheck overlay on the right, and a compact
agent receipt area driven by the custom event. Keep the existing 1,600-node tree
in the DOM but visually hidden in recording mode.

- [ ] **Step 4: Verify E2E green**

```bash
pnpm test:e2e:mcp
```

Expected: packed roundtrip, isolation/handoff, and recording presentation all pass.

- [ ] **Step 5: Implement and run deterministic recording**

The script installs packed packages, starts one hub/app, connects a real stdio
client, records a 1280×720 Playwright context, performs the watch/send/receive
sequence with bounded visible pauses, saves WebM temporarily, and invokes
ffmpeg to create a 12–15 fps optimized GIF and poster. Cleanup runs in `finally`.

```bash
pnpm demo:record
```

- [ ] **Step 6: Inspect the generated media**

Check dimensions, duration, frame count, and file size with `ffprobe`; inspect
the poster and representative GIF frames visually; rerun the recording if text
is clipped, the receipt is not visible, or the asset exceeds 8 MB.

- [ ] **Step 7: Embed the real demo**

Replace the README hero recording comment with the GIF. Add
`RealAgentDemo.tsx` to the landing page near the agent roundtrip section with
descriptive alt text, a link to quickstart, and a caption explaining that the
recording uses packed packages and a real MCP SDK client.

- [ ] **Step 8: Verify site asset and build**

```bash
test -s apps/web/public/demo/vibe-check-agent-roundtrip.gif
test -s apps/web/public/demo/vibe-check-agent-roundtrip-poster.png
pnpm --filter web build
```

- [ ] **Step 9: Commit**

```bash
git add e2e/mcp-roundtrip apps/web README.md package.json
git commit -m "docs: showcase the real widget agent roundtrip"
```

### Task 7: Full release-quality verification and PR

**Files:**
- Modify only files required by failures proven during this verification.

**Interfaces:**
- Produces a pushed branch, reviewable PR, and running local production showcase.

- [ ] **Step 1: Run the complete gate from clean outputs**

```bash
pnpm clean
pnpm test
pnpm lint
pnpm build
pnpm --filter web lint
pnpm --filter @wcgw/vibe-check-scan-worker lint
pnpm --filter @wcgw/vibe-check size
pnpm test:e2e:mcp
pnpm publish:dry
pnpm --filter web cf:build
pnpm --filter web exec wrangler deploy --dry-run
pnpm smoke:production
```

- [ ] **Step 2: Audit the implementation against the design**

Confirm every acceptance requirement maps to code and evidence, workflows
contain no long-lived npm token, setup dry-run is non-mutating, the demo is from
the real MCP result, and `git diff --check` is clean.

- [ ] **Step 3: Start the local production showcase**

```bash
pnpm --filter web start --port 3100
```

Verify `/`, `/docs/quickstart`, and the demo GIF return 200, then leave the
server running for handoff.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin codex/release-automation-onboarding
gh pr create --base main --head codex/release-automation-onboarding \
  --title "Automate releases and scaffold VibeCheck setup" \
  --body "Adds guarded npm/Cloudflare release automation, scheduled production smoke checks, the tested MCP setup scaffold, compatible Next routing cleanup, and a real packed widget-to-agent recording. Verification details are included in the PR checklist."
```

Include setup prerequisites, verification counts, local showcase URL, and the
fact that this branch does not publish a new npm version.
