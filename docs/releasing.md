# Releasing VibeCheck

Releases are dispatched manually from `main`, but every verification, npm
publish, Cloudflare deploy, production check, tag, and GitHub release step is
performed by `.github/workflows/release.yml`.

## One-time repository setup

Create a GitHub environment named `production`. Add these environment secrets:

- `CLOUDFLARE_API_TOKEN` — a scoped token that can edit Workers Scripts and
  Workers Routes for the account that owns `wcgw.fun`.
- `CLOUDFLARE_ACCOUNT_ID` — the account containing `vibe-check-web`.

The environment may require a reviewer if releases should pause for approval.
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

Trusted publishing uses GitHub OIDC and short-lived credentials. Do not add an
`NPM_TOKEN` secret. The workflow uses Node 24 and npm 11.5.1 or newer because
those versions support npm trusted publishing and automatic provenance.

## Prepare a release

1. Update the version in `packages/core/package.json`,
   `packages/mcp/package.json`, and `packages/react/package.json`.
2. Update internal workspace dependency ranges and `pnpm-lock.yaml` when the
   version change requires them.
3. Add the release notes to `CHANGELOG.md`.
4. Merge the version change and confirm CI is green on `main`.

Validate locally before dispatching:

```bash
pnpm release:validate -- 0.3.0
pnpm publish:dry
```

## Dispatch

Open **Actions → Release → Run workflow**, select `main`, and enter the exact
version without a `v` prefix. The job will:

1. Validate all public package versions and any existing tag.
2. Run type-checks, unit tests, builds, size budget, packaged MCP E2E, and a
   publish dry run.
3. Query npm and publish only package versions that are still missing.
4. Deploy `vibe-check-web` through Wrangler.
5. Smoke-test the public domain.
6. Create `v<version>` and the GitHub release only after production is healthy.

If a run fails after one or more packages reached npm, fix the cause and rerun
the same version. `release:publish` skips immutable versions already present and
continues with missing packages. A rerun also reuses an existing tag only when
it points at the same commit; it refuses to move a release tag.
