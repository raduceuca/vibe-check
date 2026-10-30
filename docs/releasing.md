# Releasing VibeCheck

Releases are dispatched manually from `main`, but every verification, npm
publish, Cloudflare deploy, production check, tag, and GitHub release step is
performed by `.github/workflows/release.yml`. There is no second publish path:
do not publish from a laptop.

## One-time repository setup

Create a GitHub environment named `production`.

- **Deployment branches:** restrict it to `main` (Settings → Environments →
  production → Deployment branches and tags → Selected branches → `main`). npm
  trusted publishing only checks the workflow file name and the environment, so
  this setting is what stops a modified `release.yml` on another branch from
  getting a publish token. A required reviewer is optional.
- **Secrets:**
  - `CLOUDFLARE_API_TOKEN` — a scoped token that can edit Workers Scripts and
    Workers Routes for the account that owns `wcgw.fun`.
  - `CLOUDFLARE_ACCOUNT_ID` — the account containing `vibe-check-web`.
- **Variables (optional):** `NEXT_PUBLIC_SCAN_API` — the public URL of the
  deployed scan worker. It is inlined into the `/scan` page at build time. Leave
  it unset until `apps/scan-worker` is deployed with a real D1 database; the
  page then ships without the shared leaderboard. The preflight refuses a
  `localhost` or `127.0.0.1` value.

The scan worker's server-side settings (`SCAN_WORKER_URL`, `SCAN_WORKER_SECRET`)
are read by the site at runtime. Set them as secrets on the `vibe-check-web`
Worker (`wrangler secret put`) once the scan worker exists; until then the site
skips recording scans.

The workflow's concurrency group allows only one production release at a time.

For each public npm package, open its npm package settings and configure a
GitHub Actions trusted publisher with these exact values:

| Field | Value |
| --- | --- |
| Organization or user | `raduceuca` |
| Repository | `vibe-check` |
| Workflow filename | `release.yml` |
| Environment | `production` |
| Allowed action | `npm publish` |

Configure all three packages:

- `@wcgw/vibe-check-core`
- `@wcgw/vibe-check-mcp`
- `@wcgw/vibe-check`

`@wcgw/vibe-check-protocol` is private and bundled into the others; it is never
published.

Trusted publishing uses GitHub OIDC and short-lived credentials. Do not add an
`NPM_TOKEN` secret. The workflow uses Node 24 and npm 11.5.1 or newer because
those versions support npm trusted publishing and automatic provenance.

## Prepare a release

1. Set the same version in `packages/core/package.json`,
   `packages/mcp/package.json`, `packages/react/package.json`, and
   `packages/protocol/package.json` (all four move in lockstep).
2. Run `pnpm --filter @wcgw/vibe-check-protocol build`. It regenerates
   `packages/protocol/src/version.generated.ts`, which every setup command the
   widget and CLI print is built from. Commit the regenerated file.
3. Update every copyable `@wcgw/vibe-check-mcp@X.Y.Z` pin in `README.md`,
   `packages/*/README.md`, `skills/**/SKILL.md`, `demo/`, and `docs/launch/`.
   `release:validate` lists any you missed. It does not check `apps/web` yet;
   update the site's pins by hand.
4. Add a `## X.Y.Z` section to `CHANGELOG.md`. It becomes the GitHub release
   notes, and `release:validate` fails without it.
5. Merge the version change and confirm CI is green on `main`.

Validate locally before dispatching (the package check packs the built
packages, so run `pnpm build` first):

```bash
pnpm release:validate -- 0.4.0
pnpm build
pnpm release:check-packages -- 0.4.0
```

## Prereleases

A version with a prerelease part (for example `0.5.0-rc.1`) is published under
the npm `next` dist-tag, so `npm install` and `npx …@latest` keep resolving to
the last stable version. Its GitHub release is marked as a prerelease instead
of latest. Install it explicitly with `@next` or the exact version.

## Dispatch

Open **Actions → Release → Run workflow**, select `main`, and enter the exact
version without a `v` prefix. The job will:

1. Preflight the deploy: fail within seconds, before anything is built or
   published, if the Cloudflare secrets are empty or Cloudflare rejects them,
   or if `NEXT_PUBLIC_SCAN_API` points at a local address.
2. Validate the package versions, documentation pins, CHANGELOG section,
   generated protocol version, and any existing tag.
3. Run type-checks, unit tests, builds, size budget, and the packaged MCP E2E.
4. Pack each public package and check the tarball: only `dist/`, `README.md`,
   `LICENSE` and `package.json`; every entry point present; no `workspace:`
   ranges; the private protocol package bundled, not imported; README images
   as absolute URLs.
5. Query npm and publish only package versions that are still missing, with the
   `latest` dist-tag (or `next` for a prerelease).
6. Deploy `vibe-check-web` through Wrangler.
7. Smoke-test the public domain (`pnpm smoke:production`).
8. Create `v<version>` and the GitHub release, with notes from the CHANGELOG
   section, only after production is healthy.

## When a run fails

If the run fails **before** the publish step, fix the cause on `main` and
dispatch again; nothing reached npm.

If it fails **after** one or more packages reached npm, those versions are
immutable and their npm provenance records the commit they were built from:

- If the fix does not need a code change (a missing secret, a Cloudflare
  outage), open the failed run and use **Re-run failed jobs**. The rerun uses
  the same commit, skips the packages already on npm, publishes any that are
  missing, and continues to the deploy, smoke check, and tag.
- If the fix needs a code change, bump to a new patch version and release that.
  Dispatching the same version from a newer commit stops before publishing:
  `release:publish` compares the provenance commit of every package already on
  npm with the run's commit and refuses a mismatch, so the git tag can never
  point at code that differs from the published tarballs.

A rerun also reuses an existing tag only when it points at the same commit; it
refuses to move a release tag.

## Production smoke monitor

`.github/workflows/production-smoke.yml` runs the same checks as the release
smoke on a schedule (and on demand). GitHub disables scheduled workflows in
repositories without recent activity; re-enable it under **Actions →
Production smoke → Enable workflow** after a quiet period.

The smoke checks the home page, the quickstart (HTML and markdown), robots,
sitemap, `llms.txt`, `llms-full.txt`, the Open Graph image, `/scan`,
`/fix/performance`, and a refused `POST /api/scan`. It cannot yet tell which
build is live; that needs a build marker in the site.
