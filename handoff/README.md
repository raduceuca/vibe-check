# VibeCheck 0.4.0 launch — handoff

Written 2026-10-30 by Claude Code for the next agent (Cursor, Grok, or a new
Claude session). Start here, then follow the work queue in order.

**Goal:** ship VibeCheck 0.4.0. That means three things:

- the packages are fixed and ready to publish to npm;
- the reimagined light-editorial site is ready to deploy to https://vibecheck.wcgw.fun;
- a deliberately broken demo shop ("Tidewell") and two integration examples showcase it.

The launch video is paused.

## Read first

1. `CLAUDE.md`: repo rules (strict TS, no `any`, named arrow exports, immutable, zero-dep core, inline-style widget, tests in `__tests__/`).
2. `PRODUCT.md`: positioning facts and the claims you may and may not make.
3. `tastefiles/site.md`: the binding brief for copy and look.
4. This file. Everything else in `handoff/` is reference, reached from the steps below.

## Guardrails

These are Radu's rules. Several are enforced by git and Claude hooks.

- Radu gives an explicit per-request go-ahead before any `git commit`, `git push`, `gh pr create`, `gh pr ready`, merge, npm publish, `wrangler`/`cf:deploy`, or workflow dispatch. Prepare the work, show the diff, ask.
- If a hook blocks you, stop and tell Radu. Never pass `--no-verify`, never delete a hook, never call the API directly to get around it.
- Work in this checkout on branch `widget/retire-proof-branding` (PR #9 → `main`, still open). Commits never land on `main`.
- Add dependencies only from the approved list under **Decisions**.
- A UI change is done when it has been checked in a real browser at 390, 768 and 1440 px; unit tests and jsdom alone don't count. Tag anything you only read in code as `[UNVERIFIED]`.
- The working tree holds uncommitted work: the in-progress package fixes, `tastefiles/`, `handoff/`, and a one-line fix in `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts` that clicks "Need to add the MCP server?". Keep all of it. Leave the untracked tooling folders (`.agents/ .claude/ .codex/ .impeccable/ skills-lock.json skills/autofix skills/code-review`) alone.

## Decisions (settled with Radu; build on them)

| Topic | Decision |
|---|---|
| Version | `0.4.0` in lockstep for core, mcp and react. `@wcgw/vibe-check-protocol` stays private and bundled. `MCP_PACKAGE_SPEC` is generated from `packages/mcp/package.json`, never typed by hand. |
| Problem count | Info-level findings **keep** counting toward the widget's "N problems" pill and health colour. |
| No-hub "mark as fixed" | Becomes an honest **dismiss**. Without a hub, nothing gets verified. |
| Framing | "Your agent built it. You decide if it ships." The human stays in control. Five vibes: **Smooth, Light, Clean, Findable, Quotable**. |
| Look | Light editorial, per `tastefiles/site.md`. Pure neutrals, single-ink headlines, at least 14 px for readable copy, red only for a real caught fault, no print/press/proof motifs. |
| Dependencies approved 2026-10-26 | `examples/vite-react` and `examples/next-app-router` as private workspace packages, using **only** versions already in `pnpm-lock.yaml` (vite 8, @vitejs/plugin-react 6, next 16.2.10, react 19.2.4, typescript 5.9). Vendored `moment.min.js` (MIT) in `demo/public/vendor/`. Nothing else. |
| Video | **Paused.** Storyline "Looks done" is chosen, details in Work queue §6. |
| Magnific | The connected Magnific MCP belongs to a former employer. Never use it. |

## Status at hand-off

**Done:**

- **Audit:** 134 verified findings, each checked by an adversarial verifier, in `handoff/audit/findings-<area>.md`. Areas are publish, live (end-to-end test), core, widget, mcp, site and release.
- **Site and showcase build spec:** `handoff/site-spec.md`.
- **Package-fix contract:** `handoff/package-contract.md`. It has the ownership map (§1), the owner of every finding (§2) and the cross-package TypeScript contracts (§3).
- **Foundation step**, reported in `handoff/impl/foundation.md`:
  - all packages bumped to 0.4.0;
  - the MCP version spec is now derived;
  - `MCP_TOOL_CATALOG` added;
  - protocol shapes for verification, payload bounds, hub security and lease/dispatch rules.

**In flight** when this was written, as the Claude workflow `vibe-check-package-fixes`:

- six fixers (core-engine, core-detectors, mcp-hub, mcp-cli, react-widget, release-docs);
- then integration;
- then four adversarial reviews;
- then a final fix pass.

Each one writes `handoff/impl/<owner>.md` when it finishes; Claude copies them in at the end. A missing report means that owner's work may be **partially applied** to the working tree, uncommitted.

## Work queue

### 1. Finish the package fixes

1. List `handoff/impl/`. For every owner in contract §1 that has no report, or reports skipped IDs:
   - diff its files: `git diff -- <its globs>`;
   - check them against its IDs in contract §2;
   - finish each unfixed ID using the contract §3 shapes and the evidence and suggested fix in `handoff/audit/findings-<area>.md`.
2. Prove each blocker fixed with a command or test:
   - **MCP-01:** a POST to the hub with `Origin: https://evil.example`, or a rebinding `Host`, is rejected. No `Access-Control-Allow-Origin: *` anywhere.
   - **MCP-02:** `GET /%` returns 400 and the hub keeps running.
   - **C1:** reloading a page with nothing fixed records no verified fix. A fix applied by HMR does verify (C4).
   - **C2:** a page with heavy console and DOM churn keeps every beacon payload under 64 KB, and the beacon stays alive.
   - **C3:** a page running the SEO and AEO audits shows no `duplicate-requests` issue against its own probes.
   - **Version (P1, P2, REL-1, REL-2, E2E-01):** no `vibe-check-mcp@0.3.0` left outside `CHANGELOG.md` and `handoff/`. Check with `grep -rn "vibe-check-mcp@0.3.0" --exclude-dir=node_modules --exclude-dir=handoff .`
   - **E2E-02, E2E-03, MCP-04, MCP-05:** an issue sent while no agent is actively waiting is kept and re-offered, never dropped. Status says "leased" versus "watching" truthfully.
3. Run the gate from the repo root. All of it must pass:

   ```bash
   pnpm build && pnpm lint && pnpm test \
     && pnpm --filter @wcgw/vibe-check size \
     && pnpm test:e2e:mcp && pnpm test:clients \
     && pnpm release:validate -- 0.4.0 && pnpm publish:dry
   ```

   - `apps/web` tests that assert the old press/proof landing copy may stay red until step 2 rewrites them. Say so; don't weaken them.
   - `publish:dry` must list core, mcp and react at 0.4.0.
4. Make sure `CHANGELOG.md` has an honest `## 0.4.0` entry in plain product language, grouped New / Fixed / Security.

**Done when:**

- the gate is green except the noted `apps/web` copy tests;
- every blocker and major in contract §2 is either fixed with a test, or listed in `handoff/impl/STATUS.md` with the reason;
- each blocker in step 2 has its proof recorded in `handoff/impl/STATUS.md`.

### 2. Rebuild the site (`apps/web`)

Follow `handoff/site-spec.md`: build order §13, steps 2–7, then step 10.

- Fold in every `SITE-*` finding from `handoff/audit/findings-site.md`. Note especially:
  - **SITE-03:** `cf:deploy` bakes `.env.local` into the production Worker;
  - **SITE-04 and SITE-05:** docs say "nine tools" and call `resolve_issue` instant;
  - **SITE-06:** stale `/.well-known/mcp.json`;
  - **SITE-07:** the landing's own widget reports problems at rest;
  - **SITE-08:** print marks in the diagrams and detector art.
- **Before you build on them, confirm the core and protocol APIs from step 1 exist** (contract §3.8): `engine.recheck`, `clearIssues(detector)`, `getAuditRun`, `probeFetch`, `MCP_PACKAGE_SPEC`, `MCP_TOOL_CATALOG`. Any that are missing go back into step 1; don't stub them.
- The landing must pass its own vibe check at rest: 0 problems, SEO 19/19, AEO 9/9, CLS 0.

**Done when:** every acceptance criterion in spec §10.4 passes on `pnpm --filter web build && pnpm --filter web start`, and once on `pnpm --filter web cf:preview`, in a real browser at 390, 768 and 1440 px. The banned-copy and 14 px type-floor tests from spec §10.2 must exist and pass.

### 3. Tidewell demo and examples

Spec §8.1 (Tidewell replaces `demo/`) and §8.2 (`examples/vite-react`, `examples/next-app-router`). Only the approved dependencies above.

- Tidewell product photos are generated, not stock. `nano-banana-pro` / `gen-asset` are Claude skills on Radu's own Gemini key. Elsewhere, ask Radu.
- No picsum, no `jsonplaceholder`, no fake "trusted by" logos, stats or star counts.

**Done when:**

- in Chrome, `?scenario=broken` trips all 13 detectors and `?scenario=fixed` reads 0 warnings or errors;
- `e2e/mcp-roundtrip/site/examples.spec.ts` is green: vite-react shows exactly its 3 documented AEO misses, next-app-router exactly `mcp-discovery-missing`;
- the demo README walks through a real Send → Fixed loop.

### 4. Recording and screenshots

- Re-record the agent round trip in a light shell, through **Verifying → Fixed**, following spec §4.6 "Re-recording". The output goes to `apps/web/public/demo/run.{mp4,webm}` plus a poster and the transcript and chapters JSON. Every value in them comes from the real run.
- Replace `docs/screenshots/*.png`. They show the retired proof/CMYK styling (findings P7, REL-4, W6). Take new ones from Tidewell with the current widget, and repoint `README.md` and `packages/react/README.md` at them.

**Done when:** no image in any README or on the site shows print/proof chrome, and the recording visibly goes Send to agent → Sent → With agent → Verifying → Fixed.

### 5. Release readiness (Radu acts; you prepare)

Radu has to:

- add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the GitHub `production` environment (REL-3, SITE-01; none exist today);
- confirm npm trusted publishing for the three packages (`docs/releasing.md`);
- approve the commit, push and PR;
- merge to `main` himself;
- dispatch **Actions → Release** with `0.4.0`.

You prepare:

- the PR description: summary, the full commit history, test plan;
- a green CI run on the branch;
- the release workflow ordering where a Cloudflare preflight fails **before** npm publish, which is irreversible.

**Done when:** Radu has a reviewed diff, a green CI run, and a checklist of exactly what he must click.

### 6. Launch video (paused; only on Radu's request)

- **Brief:** `tastefiles/video.md`.
- **Storyline "Looks done":**
  1. one continuous camera take across a polished, agent-built Tidewell shop: "Looks done";
  2. the corner pill turns red: "Feels wrong";
  3. push into the panel: problems in plain words;
  4. Send to agent → Sent → With agent → Verifying → Fixed, from the real recording;
  5. pull back: the pill is green;
  6. end card: "Your agent built it. You decide if it ships."
- **Deliverables:** a 30–40 s 16:9 cut, 1:1 and 9:16 cut-downs, and a 15 s silent loop.
- **Tooling:** HyperFrames, via `npx hyperframes`, with the `hyperframes` and `motion-doctrine` skills.
- **Audio:**
  - the music bed is a Pixabay track (free, no attribution);
  - sound effects come from the ElevenLabs Sound Effects API, with the key in `~/.config/elevenlabs/api_key`;
  - Radu's ElevenLabs plan is free, so its Music API returns 402.

## Reference index

| File | What it holds |
|---|---|
| `handoff/package-contract.md` | Ownership map, finding → owner, cross-package TypeScript contracts, expected temporary breakages, integration order |
| `handoff/audit/findings-<area>.md` | Per-finding detail, evidence, suggested fix and verifier verdict. Repro scripts they cite under `/private/tmp/...` may be gone; rebuild them from the evidence. |
| `handoff/site-spec.md` | Site and showcase build spec: copy, components, tokens, fonts, tests, acceptance |
| `handoff/impl/*.md` | Reports from finished package-fix owners |
| `tastefiles/site.md`, `tastefiles/video.md` | Binding briefs for feel |
| `docs/releasing.md` | Release mechanics and one-time npm and Cloudflare setup |
