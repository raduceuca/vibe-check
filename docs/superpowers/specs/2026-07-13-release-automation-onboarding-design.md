# Release Automation and Onboarding Design

## Goal

Turn the manual `v0.2.0` release path into a repeatable maintainer workflow,
make production health observable, reduce a new React project from no
VibeCheck configuration to a working widget and MCP client, remove current
Cloudflare/Next warnings, and publish a recording made from the real packaged
widget-to-agent round trip.

## Scope

This batch delivers five independently testable capabilities on one branch:

1. A guarded, resumable GitHub Actions release workflow.
2. A scheduled production smoke test that can also run locally.
3. A `vibe-check-mcp setup` scaffold for React projects and supported agents.
4. Removal of deprecated Next.js middleware through configuration rewrites and
   a current Cloudflare compatibility date.
5. A deterministic GIF recorded while a real MCP client receives a real issue
   from packed workspace packages.

It also fixes the clean-clone `pnpm test` bootstrap failure discovered while
preparing this batch. No package version is bumped and no new npm release is
performed by this branch.

## Release Workflow

### Alternatives considered

- **Guarded manual orchestrator (selected):** a maintainer dispatches the
  workflow with a version already committed to `main`. The workflow validates
  package versions, runs the entire release gate, publishes only missing
  package versions, deploys Cloudflare, and creates the tag and GitHub release
  last. This matches the proven manual sequence while being safe to rerun after
  a partial failure.
- **Tag-driven publishing:** pushing `vX.Y.Z` starts publishing. This is simple,
  but creates a public release marker before npm and Cloudflare are known good
  and makes rollback or retry semantics less clear.
- **Changesets:** strong for frequent multi-package versioning, but introduces a
  release PR bot and additional policy before the project has enough release
  volume to justify it.

The selected workflow uses GitHub's `production` environment, a single
concurrency group, Node 24, npm trusted publishing through OIDC, and scoped
Cloudflare secrets. npm requires each public package to trust the exact workflow
filename before the first automated publish. The workflow will document that
one-time account setup.

The publish helper checks the registry package-by-package. Versions already on
npm are skipped, allowing a failed run to resume without trying to overwrite an
immutable release. The final tag must either not exist or already point at the
same commit.

## Production Smoke Monitoring

`scripts/production-smoke.mjs` exposes a pure `runProductionSmoke` function and
a CLI. It checks the homepage, quickstart, robots, sitemap, `llms.txt`, and Open
Graph image for status, content type, and a route-specific content assertion.
Each route gets bounded retries to tolerate brief edge propagation while still
failing persistent errors.

`.github/workflows/production-smoke.yml` runs the same CLI every 30 minutes and
on demand. A failure is visible as a failed Actions run and includes the exact
route/reason in logs and the job summary. Local maintainers use
`pnpm smoke:production` against the production default or an explicit origin.

## Setup Scaffold

The public entry point is:

```bash
npx -y @wcgw/vibe-check-mcp@<version> setup --agent codex
```

Supported agent values are `codex`, `claude-code`, and `cursor`. Optional
`--project <id>` overrides the project ID derived from `package.json`; optional
`--dry-run` reports all actions without writing files or running commands; and
`--force` permits replacing the generated component only.

The command:

1. Requires a package.json with React in dependencies, devDependencies, or
   peerDependencies.
2. Detects pnpm, npm, yarn, or Bun from lockfiles.
3. Installs `@wcgw/vibe-check` at the same version as the running MCP CLI unless
   the widget is already declared.
4. Creates `src/VibeCheckDevtools.tsx` when `src/` exists, otherwise
   `VibeCheckDevtools.tsx` at the project root.
5. Configures Codex or Claude through their official CLI command, skipping an
   already configured server. Cursor is configured by merging the
   `vibe-check` entry into `.cursor/mcp.json` without removing other servers.
6. Prints the component import/mount step, hub command, verification command,
   and project-specific `watch_for_issue` instruction.

The scaffold deliberately does not rewrite `App.tsx`, a Next layout, or another
framework entrypoint. Those files vary too much for a safe first release; the
generated named component makes the remaining one-line mount explicit and
reviewable.

Filesystem access and subprocess execution are injected behind small interfaces
so setup behavior can be tested in temporary directories without modifying real
agent configuration.

## Next.js and Cloudflare Compatibility

The static Markdown aliases and `Accept: text/markdown` negotiation move from
`apps/web/middleware.ts` into `next.config.mjs` rewrites. This removes the Next.js
16 middleware deprecation without introducing a runtime hook. Route behavior is
covered with Next's configuration test helper plus production and OpenNext
builds.

An initial direct migration to `proxy.ts` was tested and rejected: Next.js 16
runs Proxy on the Node.js runtime, while OpenNext for Cloudflare does not support
Node.js middleware. Configuration rewrites preserve the behavior and remain
compatible with the deployed adapter.

The Worker compatibility date becomes `2026-07-13`. Existing
`nodejs_compat` and `global_fetch_strictly_public` flags remain unchanged because
the scanner depends on Node DNS/network APIs and the public-fetch restriction.

## Real Demo Recording

The existing packed MCP E2E fixture remains the source of truth. A dedicated
recording script launches the packed widget, real hub, real stdio MCP bridge,
and a real SDK client. It starts `watch_for_issue`, waits for the widget's green
agent state, clicks **Send to agent**, and only displays the received-agent
confirmation after the MCP tool returns the issue.

The fixture exposes a recording-only presentation when `?recording=1` is set.
The generated GIF is stored at
`apps/web/public/demo/vibe-check-agent-roundtrip.gif`, embedded near the top of
the repository README, and shown on the landing page with a caption stating
that it was captured from the packed E2E flow. The normal E2E suite does not
regenerate or modify the committed asset.

## Failure Handling

- Release validation fails before publishing when versions disagree, the
  dispatch is not on `main`, or the tag points elsewhere.
- A publish rerun skips exact versions already present on npm.
- Setup refuses non-React projects, malformed Cursor JSON, or an existing
  generated component unless `--force` is supplied.
- Setup never mutates agent configuration during `--dry-run`.
- Smoke checks return a nonzero exit with the failing route and assertion.
- Demo recording cleans up child processes and temporary installs even when a
  step fails.

## Verification and Acceptance

- A clean worktree can run `pnpm test` without a prior manual build.
- Tooling unit tests cover release version validation, resumable publishing,
  route smoke checks, retries, and failure output.
- MCP tests cover CLI parsing, package-manager detection, generated component
  content, dry-run, idempotency, Cursor merge preservation, and CLI command
  selection.
- Next rewrite tests prove HTML/Markdown negotiation behavior; the production
  build contains no middleware deprecation warning and the OpenNext build
  accepts the result.
- `pnpm test`, `pnpm lint`, `pnpm build`, the packaged MCP E2E suite, publish dry
  run, Cloudflare dry run, and production smoke all pass.
- The generated GIF is visually inspected and both README and site resolve it.
