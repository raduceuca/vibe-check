# VibeCheck public site and showcase: final build spec

- **Date:** 2026-10-26
- **Applies to:** `apps/web` (landing, shell, metadata, `/scan`, `/fix` styling, docs touchpoints), `demo/`, a new `examples/`, and `e2e/mcp-roundtrip` (recording and dogfood gate).
- **Built from:** the "Your Call" (ritual) concept, which scored highest, with the judges' grafts applied and everything on their must-avoid lists dropped.
- **Binding sources:** `tastefiles/site.md` (feel) and `PRODUCT.md` (facts). This spec doesn't override either.
- **Status:** I wrote this from reading the code only. Nothing here has been built, run or opened in a browser. Anything about runtime behaviour is marked **[UNVERIFIED]** and needs checking on a production build at 390, 768 and 1440 px before anyone calls it done.

---

## 0. Non-negotiables

1. **Light editorial.**
   - White page, pure neutral inks, and type doing the work.
   - The live widget is the product shot and the only dark object on the page.
   - Headlines are one ink colour.
2. **Colour is earned.**
   - The landing uses no green.
   - At rest, the only colour on screen is the widget's own health dot.
   - Amber means "re-checking". Red means a real fault was caught.
   - Every colour is paired with a word.
3. **Show, don't tell.**
   - Readings are live and faults are real.
   - The round trip is a real recording from the e2e test.
   - No mock screenshot is presented as live.
4. **Honest delivery.**
   - Nothing on the public site is ever "sent".
   - A copied prompt is not a delivery.
   - "Fixed" means fresh browser readings said so.
5. **Plain product language.**
   - No print, press or proof vocabulary or chrome (banned list in §10.3).
   - No newspaper costume: mastheads, column rules, drop caps, "Vol./No.".
6. **Readable copy is at least 14 px.** No uppercase micro-labels.
7. **No invented traction anywhere,** demo included: stars, logos, testimonials, "used by", counts.
8. **The landing must pass its own vibe check at rest:** 0 problems, SEO 19/19, AEO 9/9, CLS 0.
9. **Banned patterns:**
   - scroll reveals
   - ink-filled black buttons
   - dark code blocks, terminals or video shells
   - red side-stripes
   - eyebrow dot triples
   - numbered section numerals
   - icon-card grids
   - tints, gradients and glass
10. **Consent gates (Radu's rules):**
    - Adding any dependency needs a one-line proposal and `[ok-to-add-dep]`.
    - Commits, pushes, publishes and deploys need explicit per-request consent.
    - Nothing in this spec authorises any of them.

---

## 1. Release gate and prerequisites (land these before the landing makes any claim)

### R0. Publish a version that has `up` (blocking)

**The problem.** The published `@wcgw/vibe-check-mcp@0.3.0` has no `up` command. I checked the packed tarball. Its usage line lists only `hub | connect | doctor | stats | setup | register`. The workspace source (`packages/mcp/src/cli.ts:249`) does have `up`, but every package is still versioned `0.3.0`, and `MCP_PACKAGE_SPEC = '@wcgw/vibe-check-mcp@0.3.0'` is hard-coded in `packages/protocol/src/index.ts:281`. Any page that tells visitors to run `npx -y @wcgw/vibe-check-mcp@0.3.0 up` fails for every one of them today.

**What to do:**

- Bump all four packages and `MCP_PACKAGE_SPEC` to the next version together. I suggest `0.4.0`; the version and the publish are Radu's call.
- Validate with `pnpm release:validate <v>`, then publish.
- Deploy the site only after that publish.
- All site and docs commands read `MCP_PACKAGE_SPEC`, so they update by themselves.
- **New test (`scripts/__tests__/version-sync.test.ts`):**
  - The version inside `MCP_PACKAGE_SPEC` equals `packages/mcp/package.json` `version`.
  - The usage string in `packages/mcp/src/cli.ts` includes ` up `.

In this document, `{v}` means the version parsed from `MCP_PACKAGE_SPEC`. It is never typed by hand and never `@latest`.

### P1. Audit probes must not flag the page as a duplicate-request offender (core)

**Read from code:**

- `aeo.ts:143` and `aeo.ts:152` fetch `location.href` back to back.
- `seo.ts` and `aeo.ts` both fetch `/robots.txt`.
- `duplicateRequests.ts:49` patches global `fetch` and keys only on `METHOD:url` within 2 s.

So every page running the engine can raise "Same data fetched multiple times" against its own audit traffic [UNVERIFIED in browser].

**Fix, in `packages/core`:**

- Add `src/utils/probe.ts`:
  - `export const VC_PROBE = Symbol.for('vibecheck.probe')`.
  - `probeFetch(url, init?)` calls `fetch(url, { ...init, [VC_PROBE]: true })`.
  - `createProbeCache()` returns a `Map<string, Promise<ProbeResult>>` keyed by `method + url + accept`.
- `duplicateRequests` ignores calls whose `init?.[VC_PROBE] === true`.
- When the engine starts or re-checks seo and aeo together, both detectors share one probe cache, so `/robots.txt` is fetched once per run.
- Export `probeFetch` from `src/index.ts`. The site uses it for "Read this page the way an agent does".
- **Tests** (`detectors/__tests__/duplicateRequests.test.ts`, `seo.test.ts`, `aeo.test.ts`):
  - Start the engine with all detectors, let seo and aeo settle, and assert there is no `duplicate-requests` issue.
  - Assert `/robots.txt` is fetched once per run.

### P2. Per-detector clear, re-check and audit status (core)

- **`clearIssues(detector?: DetectorName): void`.** Backward compatible: no argument clears everything, as today. Each detector's `clear()` already resets its dedupe state (`duplicateRequests.ts:152-155`, `domBloat` `lastThreshold`). Keep that.
- **`recheck(detector: DetectorName): Promise<void>`.** Clears, stops and starts that one detector. It resolves when the run settles: immediately for continuous detectors, and after the async probes finish for `seo`, `aeo` and `web-essentials`. Those three run once per `start()` (`hasRun`), which is why the page needs this.
  - Add it to `VibeEngine` as **optional** (`recheck?`), so `createScriptedEngine` is unaffected.
  - This also fixes SEO findings going stale after SPA route changes.
- **`getAuditRun(detector: 'seo' | 'aeo' | 'web-essentials'): AuditRun | null`.**
  - `AuditRun = { status: 'running' | 'complete' | 'incomplete', startedAt: number, finishedAt?: number, failedChecks: readonly string[], unreachable: readonly string[] }`.
  - `unreachable` lists probes that threw a network error, which is different from a 404. The page shows those as "Couldn't finish", never as passing.
- **Tests:**
  - a cleared single detector re-raises while the fault persists;
  - clearing one detector leaves the others intact;
  - `recheck('seo')` re-runs and resolves;
  - a network error lands in `unreachable`.

### P3. Placeholder titles (core)

- Add `'vite + react + ts'` and `'create next app'` to `DEFAULT_TITLES` (`packages/core/src/detectors/seo.ts:14-17`).
- Test both.
- The Tidewell demo still uses `Vite + React`, which is already in the list.

### P4. No-hub "mark as fixed" (widget; needs Radu's OK, product change)

**The problem.** With no `beaconUrl`, the panel's `mark as fixed` button calls `markResolved` locally (`VibeCheck.tsx:139-145`, label at `IssueActions.tsx:168`). On the public site that contradicts "the browser confirms".

**Proposal:** when `!beaconUrl || !projectId`, label the button `dismiss` in both modes, with the tooltip "Hide this issue. Without a hub, nothing gets verified." The internal semantics stay as they are. Add a test.

**What depends on it:** the site line "Nobody marked it fixed. The browser did." ships **only if P4 lands**. Otherwise use the fallback copy in §4.2.

### P5. One shared engine (site-only, no product change)

`useVibeCheck` calls `engine.stop()` on an injected engine when it unmounts (`packages/react/src/hooks/useVibeCheck.ts:101-105`), and StrictMode double-mounts. So:

- The site owns the engine in a provider.
- The widget gets a **stop-safe handle**: an object implementing `VibeEngine` that delegates everything, except that `stop()` does nothing.
- `start()` is already guarded by `running`.
- Memoise the handle once, because the widget's effect depends on its identity.

### Site infrastructure needed by the faults

| File | Spec |
|---|---|
| `apps/web/app/vibe-check/duplicate-probe/route.ts` | `GET` returns `new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })`, with `dynamic = 'force-dynamic'`. It replaces today's 404 probe. |
| `apps/web/public/vibe-check/fault-block.js` | A separate static script. Its own `setTimeout` chain busy-waits 120 ms five times, 60 ms apart. The long-animation-frame `sourceURL` then names this file rather than a Next chunk. Loaded as `fault-block.js?r=<n>`. |
| `apps/web/public/vibe-check/faults/IMG_4032.jpg` | A CC0 or self-shot photo, 4032×3024, about 2.4 MB, no EXIF location. Loaded only on click, as `IMG_4032.jpg?r=<n>`. The cache-bust guarantees `transferSize > 0`; `largeImages.ts:43` skips `transferSize === 0`. The vibe title it produces is `IMG_4032.jpg is {KB}KB`. |

---

## 2. Thesis

> **Your agent built it. You decide if it ships.**

The landing is a vibe check done on itself.

**What the reader does:**

1. reads this page's five live readings (Smooth, Light, Clean, Findable, Quotable), measured by the same engine as the dark panel in the corner;
2. breaks the page the way agents do, and watches VibeCheck catch it in plain words, with the first red mark on the page pinned to the element they broke;
3. learns that nothing goes to an agent until they press Send;
4. watches a real recorded round trip;
5. sees that a fix counts only when fresh readings say so;
6. ends at a card that sets out the evidence and leaves the call to them, then gets the install steps.

**The one navigation device** is the four-step loop list in §4.3, whose items anchor to their sections. There are no "Step N of 5" labels, no sticky step rail and no section numerals.

---

## 3. Shell and navigation

### 3.1 Decision

| Route | Shell |
|---|---|
| `/`, `/scan` | **New top bar** (`SiteShell variant="topbar"`). No sidebar. |
| `/fix/**` | Keeps `SiteSidebar`. The 43 guides need a tree. Proof bits removed, sentence-case labels, 14 px floor. |
| `/docs/**` | Keeps Fumadocs `DocsLayout`, re-skinned (§9). |

### 3.2 Top bar (`apps/web/components/site/SiteTopBar.tsx`, server; `SiteMenu.tsx`, client)

**At 768 px and up:**

- Static, not sticky. 64 px tall, with a 1px `--vc-line` bottom border. Wrapped in a `<header>`.
- **Left:** `BrandMark` (circle-check) plus the wordmark `VibeCheck`. One ink, one weight (Geist 600, 17 px). Remove the `.vc-side-brand-2` split. It links to `/` (`aria-label="VibeCheck home"`).
- **Right links** (Geist 500, 15 px, ink-2; hover ink-1, underline offset 4 px):
  - `Fix guides` → `/fix`
  - `Docs` → `/docs`
  - `Scan a URL` → `/scan`
  - `GitHub` → `GITHUB_URL`, external, with a visible ↗ that is `aria-hidden`
- **Then an outlined button** `Install`, linking to `#install` on `/` and to `/#install` on `/scan`.
- **Skip link** before the bar: `Skip to content` → `#main`. Visible on focus only, 15 px.

**Below 768 px:**

- 56 px tall: wordmark, `Install`, and a 44×44 `Menu` button (`aria-expanded`, `aria-controls="vc-site-menu"`).
- The drawer reuses the existing `SiteSidebar` mobile drawer behaviour: Escape closes it, body scroll locks, focus returns to the button. Hit areas go up from 40 to **44 px**.
- Drawer items: `Fix guides`, `Docs`, `Scan a URL`, `Examples` (`/docs/examples`), `GitHub`, `Changelog` (`${GITHUB_URL}/releases`).

### 3.3 Footer (`apps/web/components/site/SiteFooter.tsx`, server; used on `/` and `/scan`)

- **Lead** (Newsreader 500, H2 scale minus one step, single ink): `Keep building fast. Keep the final say.`
- **Line** (Geist 15 px, ink-2): `Open source under MIT. Zero runtime dependencies in core. Runs on your machine: no account, no hosted service.`
- **Links** (one wrapped row, `·` separators that are `aria-hidden`):
  - `Docs` → `/docs`
  - `Quickstart` → `/docs/quickstart`
  - `Fix guides` → `/fix`
  - `Scan a URL` → `/scan`
  - `Examples` → `/docs/examples`
  - `MCP tools` → `/docs/reference/mcp-tools`
  - `llms.txt` → `/llms.txt`
  - `Changelog` → `${GITHUB_URL}/releases`
  - `GitHub` → `GITHUB_URL`
  - `npm` → `https://www.npmjs.com/package/@wcgw/vibe-check`
- **Byline** (14 px, ink-3): `Made by Radu Ceuca.` Links to `https://github.com/raduceuca`. Then ` · ` and `v{v}` via `SiteVersion`.
- **Mobile:** the bottom padding is 96 px, so the 44 px pill never covers a link.

### 3.4 Brand components

- `components/brand/NavigationBrand.tsx`: single-ink wordmark. Rename `ProofVersion` to `SiteVersion`. It renders `v{v}` where `{v}` is parsed from `MCP_PACKAGE_SPEC`. Delete the `SITE_VERSION = '0.3.0'` literal.
- `lib/layout.shared.tsx`: use `SiteVersion` and drop the rosette and proof leftovers.
- `app/icon.svg`: the circle-check mark in `#111112` on a transparent background. No crosshair, no red.
- `app/apple-icon.tsx`: 180×180, white background, ink circle-check. No red.

---

## 4. Landing (`apps/web/app/page.tsx`)

### 4.0 File map

**All copy strings live in `apps/web/lib/landingCopy.ts`.** That file is rewritten from scratch, exported as `LANDING_COPY`, and typed `as const`. Components read from it. `lib/markdown/landing.ts`, `app/llms.txt` and the OG image are generated from it.

| Action | Path | Notes |
|---|---|---|
| **New** | `components/live/LiveEngineProvider.tsx` (client) | In `useEffect`, lazy-imports `@wcgw/vibe-check-core`, creates one `new VibeCheckEngine({})` (no beacon, no projectId), starts it, and stops it on `pagehide` and unmount. Provides a context with `{ engine, handle, subscribe }`. Mounts `<VibeWidget engine={handle} storageKey="vibecheck-site" />` and `<WidgetLayoutSync />`. Wraps the server-rendered children. |
| **New** | `components/live/useLiveSnapshot.ts` | `useSyncExternalStore` over `engine.onSnapshot` (every 500 ms). Each island subscribes only to what it renders. |
| **New** | `lib/vibes.ts` (pure) | `VIBES` (id, name, claim, detectors, fix links), `gradeVibes(input)`, and the format helpers moved out of `LiveGauges`. |
| **New** | `lib/vibes.generated.ts` | Threshold sentences emitted by `packages/core/scripts/gen-detector-reference.mjs` (extend `pnpm gen:docs`) from the detector constants. |
| **New** | `lib/audit.ts` | Criterion labels and `buildResult` lifted from `AuditThisPage.tsx`, reading `engine.getAuditRun()` (P2). |
| **New** | `components/landing/StepHead.tsx` | `<h2>` plus optional lede. Replaces `SectionHead`; no `index` prop. |
| **New** | `components/landing/CopyButton.tsx` (client) | Visible `Copied` or failure text that resets after 2 s, with `role="status"`. |
| **New** | `components/landing/AgentPicker.tsx` (client) | Radio group `Claude Code · Codex · Cursor`. Shared between the hero and install through a tiny context. Remembered in `localStorage` key `vibecheck-site:agent`, with every read and write in try/catch. |
| **New** | `components/landing/HeroSetupLine.tsx`, `LiveLine.tsx`, `HeroNote.tsx` | §4.1 |
| **New** | `components/landing/VibeLedger.tsx` (server shell), `LedgerRow.tsx` / `VerdictLine.tsx` / `AuditList.tsx` / `AgentReadView.tsx` (client islands) | §4.2 |
| **New** | `components/landing/LoopSteps.tsx` (server) | §4.3 |
| **New** | `components/landing/FaultBench.tsx` (client), `components/landing/faults/{registry,smooth,light,clean,findable,quotable}.ts` | §4.4 |
| **New** | `components/landing/RunRecording.tsx`, `RunTranscript.tsx` (server, reads JSON) | §4.6. Replaces `RealAgentDemo` and `AgentRoundTrip`. |
| **New** | `components/landing/PhaseLine.tsx` (server) | §4.7 |
| **New** | `components/landing/YourCallCard.tsx` (client) | §4.8 |
| **New** | `components/landing/InstallSteps.tsx` (client) | §4.9 |
| **New** | `components/landing/LandingFaq.tsx` (server) | §4.10, plus the FAQPage JSON-LD |
| **New** | `components/site/SiteTopBar.tsx`, `SiteMenu.tsx`, `SiteFooter.tsx` | §3 |
| **Rewrite** | `app/page.tsx`, `lib/landingCopy.ts`, `lib/markdown/landing.ts`, `app/layout.tsx`, `app/opengraph-image.tsx`, `app/llms.txt/route.ts`, `app/llms-full.txt/*`, `components/site/SiteShell.tsx` (`variant: 'topbar' \| 'sidebar'`), `components/vibe/VibeWidget.tsx` (pass `engine` and `storageKey` through), `components/brand/NavigationBrand.tsx`, `components/diagrams/PipelineDiagram.tsx` (docs only, §9), `components/issueArt/artKit.tsx` (remove `ProcessPlate` CMYK tinting; glyphs become `currentColor` monotone) | |
| **Reuse** | `components/vibe/WidgetLayoutSync.tsx` (unchanged), the `SiteSidebar` drawer logic, `instrumentKit.tsx` (for `/fix`) | |
| **Delete** | `components/landing/DetectorsGrid.tsx`, `AgentRoundTrip.tsx`, `LiveGauges.tsx`, `AuditThisPage.tsx` (after `lib/audit.ts`), `BreakThisPage.tsx` (after `FaultBench`), `InstallCommand.tsx`, `SectionHead.tsx`, `RealAgentDemo.tsx`, `components/brand/ProofMarks.tsx` and its test, `components/site/SidebarProofMarks.tsx` (its test moves, §10), `public/demo/vibe-check-agent-roundtrip.gif`, `public/demo/vibe-check-agent-roundtrip-poster.png` (once the new poster exists) | |

**Page tree:** `<SiteTopBar/>` → `<main id="main">` → `<LiveEngineProvider>` [sections 4.1 to 4.10] `</LiveEngineProvider>` → `<SiteFooter/>`.

- There is exactly one `<h1>`.
- Every section is `<section id aria-labelledby>`.

**Collapsed-preference CLS guard.** A returning visitor who collapsed the widget would otherwise mount collapsed and re-centre the column without any input from them, which counts as CLS. Add a tiny inline `<script>` in the landing `<head>` that reads the widget prefs from `localStorage['vibecheck-site']`, wrapped in try/catch. If `collapsed === true`, it sets `document.documentElement.dataset.vcWidget = 'collapsed'` before first paint. The storage key format is [UNVERIFIED]; read `packages/react/src/store/preferences.ts` and match it.

---

### 4.1 Hero (`#top`)

| Element | Final copy | Component |
|---|---|---|
| Kicker (Geist 500, 15 px, ink-3) | `For React apps built with Claude Code, Codex, or Cursor` | static |
| H1 (Newsreader 500; two `<span class="vc-line">` blocks inside one `<h1>`, separated by a space) | `Your agent built it.` / `You decide if it ships.` | static |
| Lede | `VibeCheck is a performance and SEO overlay for AI-built frontends. It runs in the corner of your dev server, names what's wrong on the live page, and sends the one issue you pick to the coding agent working on it. A fix counts only when fresh browser readings say so.` | static |
| Primary CTA (outlined button) | `Set it up in five minutes` → `#install` | static |
| Secondary CTA (text link) | `Break this page first` plus `↓` (`aria-hidden`) → `#notice` | static |
| Setup line | Label `Set up with`, then `AgentPicker`, then a mono command `npx -y @wcgw/vibe-check-mcp@{v} setup --agent {claude-code\|codex\|cursor}`, then `CopyButton` (`Copy` → `Copied` / `Couldn't copy. Select the command instead.`) | `HeroSetupLine` (client). The command string is built from `MCP_PACKAGE_SPEC`. SSR renders the `claude-code` variant. |
| Live line (Geist 15 px, ink-2; an ink outline ring before it that breathes at 2 s and is still under reduced motion) | Hydrated: `Running on this page now · {fps} fps · {n} problem(s)`. SSR: `Running on this page now`. The number spans have a fixed `min-width` in `ch`. | `LiveLine` (client, shared engine). `{n}` = `engine.getIssues().length`. |
| Margin note (Geist 14 px, ink-3) | At 1100 px and up, while the widget is expanded: `That dark panel is VibeCheck, measuring this tab right now. It's the same package you'd install.` Below 1100 px: `VibeCheck is running on this page. Tap the pill in the bottom corner to open it.` | `HeroNote`. Both strings are in the HTML and swapped by CSS media queries, so there is no CLS. At 1100 px and up it is absolutely positioned in the reserved gutter (`left: calc(100% + 40px); width: 320px; top: 0`). It is hidden under `:root[data-vc-widget='collapsed']`, which only follows a user action. |

**The widget in the hero:**

- At 1100 px and up, the real `@wcgw/vibe-check` mounts **expanded** on the Monitor tab in the 400 px right gutter. The gutter is the first-paint default, as today, so CLS stays 0.
- Below 1100 px it is the collapsed pill. That is existing `VibeWidget` behaviour.
- The widget's theme stays its default `dark`.

---

### 4.2 Readings (`#look`)

- **H2:** `This page, checked as you read it.`
- **Body:** `Five readings from the same engine as the panel in the corner, measured in your browser while you read. Break anything below and watch its row change.`

**Verdict line** (`VerdictLine`):

- One `<p role="status" aria-live="polite" data-vc-verdict="{state}">` in Newsreader 500 at verdict scale, plus a sub-line in Geist 16 px, ink-2.
- Only this element is a live region.
- Its height is reserved: two lines on desktop, three on mobile.

| State (`data-vc-verdict`) | Verdict | Sub-line |
|---|---|---|
| `checking` | `Checking this page…` | `Reading frames, requests, the console and both audits.` |
| `pass` | `This page passes the vibe check.` | `Five of five. Now try to break it.` |
| `fail` (one vibe, caused by the reader) | `This page doesn't pass the vibe check.` | `{Vibe}: {vibe-mode issue title}.` |
| `fail` (two or more) | `This page doesn't pass the vibe check.` | `{Two\|Three\|Four\|Five} vibes caught: {A}, {B} and {C}.` |
| `rechecking` | `This page is re-checking.` | `{Vibe}: waiting for two clean readings.` |
| `restored` | `This page passes the vibe check again.` | `Confirmed by fresh readings at {HH:MM:SS}.` If P4 has landed, append ` Nobody marked it fixed. The browser did.` |
| `device` (fails at rest with no bench fault active) | `This page doesn't pass on your device.` | `{Vibe}: {vibe-mode issue title}. That's a real reading. We'd rather show it than hide it.` |
| `incomplete` (an audit has `unreachable`) | `This page couldn't finish its check.` | `{Vibe}: {probe path} didn't answer. That isn't a pass.` |

**Ledger rows** (`VibeLedger` server shell, with `LedgerRow` islands):

- Each row is a `<div role="group" aria-labelledby>` with:
  - vibe name: Newsreader 500, at the ledger-name scale;
  - claim: Newsreader 400;
  - reading: Geist Mono 500, tabular;
  - state: a word, plus a dot only when amber or red;
  - `<details>` titled `What it checks`.
- Rows are divided by 1px `--vc-line-2`.
- The SSR state for every row is `Measuring…`.

| Vibe | Claim (final) | Reading (live; format) | Fails when (`gradeVibes`) |
|---|---|---|---|
| Smooth | `Nothing jumps, nothing freezes, every tap lands.` | `{fps} fps · {n} long frames · CLS {0.00} · INP {n} ms`. Before any interaction, INP shows `INP: tap anything`. | Any `layout-thrashing` or `long-task-attribution` issue; INP rating `poor`; CLS rating not `good` **only if no Smooth bench fault ran this visit**. FPS is shown but **never** fails a row, because background tabs throttle it. |
| Light | `It loads what it uses, and nothing twice.` | `{nodes} elements · {n} repeated requests · {mb} MB heap`. Without `performance.memory`: `heap: Chrome and Edge only`. | Any `dom-bloat`, `duplicate-requests`, `memory-leak`, `unoptimized-images`, `large-images`, `resource-bloat` or `heavy-library` issue. |
| Clean | `A quiet console, and the basics in place.` | `{n} console errors · essentials {n} of 4` | Any `console-spam` or `web-essentials` issue. |
| Findable | `Search engines know what this page is.` | `{passed} of {SEO_CRITERIA_COUNT} SEO checks` | `getAuditRun('seo')` is complete with failed checks, or incomplete. |
| Quotable | `When someone asks an AI, it can quote you.` | `{passed} of {AEO_CRITERIA_COUNT} AEO checks` | Same, for `aeo`. |

**Row state words:**

- `Measuring…` (no dot)
- `Passing` (ink check glyph, no colour)
- `Caught: {vibe-mode title}` (red 8 px dot)
- `Re-checking` (amber dot, plus a 1px ink progress line `scaleX` 0→1 over the fault's `recheckMs`; under reduced motion it is text instead: `Re-checking · {s} s left`)
- `Passing again` (ink check)
- `Couldn't finish` (outline dot)

**Issue titles** on the page always come from `getSuggestion(issue, 'vibe').title`. That is the widget's default mode, so the page and the panel use the same words. The technical title is never printed on the page.

**Caught-row action.** A `Copy as agent prompt` button, using `getAgentPrompt([issue])` from core. Its toast is `role="status"` and reads: `Copied. In your own app, Send to agent delivers this to the agent watching your project. Here it's only on your clipboard. Nothing was sent.`

**`What it checks` contents.** Threshold sentences come from `lib/vibes.generated.ts`. Wording:

- **Smooth**
  - `Layout shift clusters: three or more unexpected shifts within half a second.` with the link `How to fix layout shift` → `/fix/cumulative-layout-shift`
  - `Long-frame scripts: one script behind more than three long animation frames. Chrome and Edge.` with the link `How to fix long tasks` → `/fix/long-tasks`
  - `Also read live: frame rate, long frames, CLS and INP.`
- **Light**
  - `DOM size: a warning at 800 elements, a failure at 1,500.` → `/fix/excessive-dom-size`
  - `Repeated requests: the same method and URL twice within two seconds.` → `/fix/duplicate-network-requests`
  - `Memory growth: heap up 10% (warning) or 25% (failure) over 30 seconds with no recovery. Chrome and Edge.` → `/fix/memory-leak`
  - `Mis-sized images: bigger than their box, stretched, or missing dimensions or lazy loading.` → `/fix/unoptimized-images`
  - `Heavy images: 500 KB or more on the wire, a failure at 1 MB.` → `/fix/large-image-files`
  - `Big files: any script or stylesheet over 100 KB in production, 500 KB in dev.` → `/fix/large-javascript-bundles`
  - `Heavy libraries: sixteen known heavyweights, from Moment.js to full Lodash.` → `/fix/heavy-dependencies`
- **Clean**
  - `Console noise: more than 20 console messages within 10 seconds.` → `/fix/console-log-spam`
  - `Web essentials: a favicon, a viewport tag, a page language and a character set.` with the link `Essentials guides` → `/fix/essentials`
- **Findable**
  - `The SEO audit, 19 criteria from 20 checks: title, description, social previews, canonical link, one main heading, alt text, link text, URL shape, indexability, sitemap and robots.` with the link `SEO guides` → `/fix/seo`
- **Quotable**
  - `The AEO audit, 9 checks: JSON-LD that exists and parses, a main landmark, author and date, an llms.txt, content that's there without JavaScript, a markdown version, AI crawlers allowed, and an MCP card for agents.` with the link `AEO guides` → `/fix/aeo`

**Under the ledger:**

- `Run the audits again` (outlined, small). It calls `engine.recheck('seo')` and `recheck('aeo')`.
- A `<details>` titled `Show all 28 checks` (`AuditList`). It shows ✓/✗ per criterion, misses first, and links each miss to its `/fix` guide.
- **In the Quotable row: `Read this page the way an agent does`** (`AgentReadView`):
  - It calls `probeFetch(location.href, { headers: { Accept: 'text/markdown' } })`.
  - It renders the first 14 lines of the response in a light `<pre>` (`--vc-panel`).
  - Beside it is a `<dl>` titled `Structured data found`, with `@type: name` pairs parsed from the page's JSON-LD.
  - Caption (14 px): `This is the exact response an agent gets when it asks this URL for markdown.`
  - On failure: `Couldn't fetch the markdown view. That's a real miss: report it on GitHub.`, with "report it on GitHub" linking to a prefilled new issue.
- **Caption** (14 px, ink-3): `Same engine as the panel in the corner, running in this tab. No hub is configured on this site, so nothing it measures leaves your browser.`

---

### 4.3 The loop (`#loop`)

- **H2:** `Four steps. One of them is yours.`
- **Intro:** `Your agent is fast. It's also confident about things it never looked at. VibeCheck puts a check between "it compiles" and "it ships", and you're the one holding it.`
- **`LoopSteps`.** An `<ol>` with 1px `--vc-line-2` rules between items. Each item has the step name in Newsreader 500 (H3 scale plus 2), a sentence in Newsreader 400, and an anchor link in Geist 15 px:

| # | Name | Sentence | Link |
|---|---|---|---|
| 1 | `VibeCheck notices.` | `It measures the running page from the corner of your dev server: frames, layout, memory, requests, the console, and how search and answer engines read it.` | `Break this page` → `#notice` |
| 2 | `You decide.` (followed by `Your step` in Geist 14 px, ink-3) | `Nothing goes to your agent until you press Send to agent on the issue you care about. Ignoring the rest is allowed.` | `How sending works` → `#decide` |
| 3 | `Your agent fixes.` | `One agent session holds your project and receives exactly that issue, with the evidence attached.` | `See a real run` → `#fix` |
| 4 | `The browser confirms.` | `The issue counts as fixed only after two fresh snapshots arrive without it. If it comes back later, it's marked regressed.` | `How verifying works` → `#confirm` |

---

### 4.4 Notice (`#notice`), the signature moment

- **H2:** `Now break it the way agents do.`
- **Paragraph 1:** `Agents are generous. They render all two thousand rows, drop a photo straight off the camera into a thumbnail, fetch the same data from two components, and add a banner that loads late. The page still looks finished in a screenshot. It only feels wrong when you use it.`
- **Paragraph 2:** `Each button below does one of those things to this page, for real. Press one and watch the corner.`
- **Footnote** (14 px, ink-3): `These controls change your copy of this page only. Search engines and other visitors get the real one.`

**`FaultBench`.**

- A boxed panel: 1px `--vc-line`, radius 12, white.
- An `<h3>` per vibe group. Each fault row has the button, an effect line, and a `Panel shows:` line.
- The `Panel shows:` line is computed from `getSuggestion(fixtureIssue, 'vibe').title`, and a test pins it, so it can't drift.
- The bench holds three fixed-size fault targets:
  - `#vc-banner-slot`: zero height at rest, at the top of the bench;
  - `#vc-reviews`: 100% × 240 px, `overflow: hidden`, `inert`, `aria-hidden`;
  - `#vc-photo`: 320×240 fixed box with the caption `Photo slot`, so inserting the image never shifts anything.

**Fault contract** (`faults/registry.ts`):

```ts
interface Fault {
  readonly id: FaultId
  readonly vibe: VibeId
  readonly label: string
  readonly effect: string
  readonly expects: readonly { detector: DetectorName; check?: string }[]
  readonly recheckMs: number
  readonly available: () => string | null   // null = runnable; string = disabled reason shown inline
  readonly run: (ctx: FaultContext) => void // always scheduled via afterNextPaint() so INP is untouched
  readonly undo: (ctx: FaultContext) => void
}
```

- `afterNextPaint(fn)` is `requestAnimationFrame(() => setTimeout(fn, 0))`.
- **Catch time** is `performance.now()` at the click minus the time of the first snapshot containing a matching issue. It is measured, never estimated.

**Faults (final):**

| Vibe | Button | Effect line | Panel shows | Mechanics | recheckMs | Unavailable reason |
|---|---|---|---|---|---|---|
| Smooth | `Make the layout jump` | `Three late banners push this section down, with no space reserved.` | `Page layout keeps recalculating` | Insert three banners into `#vc-banner-slot` at **700, 850 and 1000 ms** after the click. Shifts within 500 ms of input are dropped (`layoutThrashing.ts:32`), and three are needed within 500 ms (`CLUSTER_MIN_SHIFTS`). Each banner is 56 px tall, `--vc-panel-2` background, ink text `Late banner {n} of 3`. **Never red.** | 1500 | none |
| Smooth | `Freeze the main thread` | `Runs five 120 ms tasks from a separate script.` | `Something is freezing the page` | Append `<script src="/vibe-check/fault-block.js?r={n}">` after the next paint. | 2500 | `Needs Chrome or Edge.` (when `!PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')`) |
| Light | `Render every review` | `Puts 1,800 review rows into the list below.` | `Too many elements on the page`, plus a marker on the list | Append 1,800 `<p>` rows ("Review {n}: The glaze is lovely.") to `#vc-reviews`. The detector polls every 5 s. Its `selector` evidence should resolve to `#vc-reviews`; confirm that the marker lands there [UNVERIFIED]. | 5500 | none |
| Light | `Use the camera photo` | `Loads a 4032 × 3024 photo into a 320 px box. Downloads about 2.4 MB.` | `IMG_4032.jpg is {KB}KB` and `IMG_4032.jpg needs optimization`, plus a marker on the photo | `<img src="/vibe-check/faults/IMG_4032.jpg?r={n}" alt="A camera photo, far too large for its box">` with no width/height attributes, inside the fixed `#vc-photo` box. `{KB}` is computed at build from the file size. At 1 MB or more the issue is error severity, so the marker is red [UNVERIFIED: marker colour]. | 3000 | `Off because your browser asked to save data.` (`navigator.connection?.saveData`) |
| Light | `Fetch it twice` | `Requests the same tiny URL eight times in a burst.` | `Same data fetched multiple times` | 8× `fetch('/vibe-check/duplicate-probe', { cache: 'no-store' })`, which returns 204. | 2500 | none |
| Light | `Leak memory` | `Holds on to a growing array for 30 seconds, then stops growing. VibeCheck wants 30 seconds of evidence before it says anything.` | `Memory keeps growing` | Retain a 60,000-number array every 250 ms. Cap at 30 s **or** 64 MB retained, whichever comes first. Show a live counter: `Collecting evidence {s} / 30 s`. | 32000 | `Needs Chrome or Edge. This browser doesn't share heap size.` |
| Clean | `Flood the console` | `Logs 30 errors over seven seconds.` | `Too many console messages` | 30 × `console.error('VibeCheck demo: deliberate error {n} of 30')`, 240 ms apart. | 10500 | none |
| Findable | `Give this tab a placeholder title` | `Renames this tab to "Vite + React" and removes the meta description, then audits again. Look at your browser tab.` | `Your page still has a placeholder title` and `No summary for search results` | Save `document.title` and the detached `<meta name="description">` node, set the title to `Vite + React`, then `await engine.recheck('seo')`. Undo restores the exact node and title, then re-checks. | one fresh `recheck` | none |
| Quotable | `Hide the structured data` | `Removes this page's JSON-LD, then audits again.` | `AI tools have to guess what your page is about` | Detach every `script[type="application/ld+json"]` (keeping references), then `await engine.recheck('aeo')`. Undo re-inserts them in their original positions. | one fresh `recheck` | none |

**Light group footnote** (14 px): `We don't ship a heavy library or a 500 KB bundle to this page to prove a point. Tidewell, the broken shop in the repo, does.`

**Active fault:**

- The button label becomes `Undo` (`aria-pressed="true"`, `aria-label="Undo: {label}"`). No colour.
- The effect line becomes `Live on this page.`

**Undo flow:**

1. `undo()`
2. `engine.clearIssues(detector)` (P2)
3. The row goes to `Re-checking`.
4. After `recheckMs`, two consecutive snapshots with no matching issue (and, for DOM, `domNodeCount < 800`) set the row to `Passing again`.
5. If the issue is still present, the row shows `Still caught. VibeCheck still sees it: {vibe title}.`

**Reset button:** `Put it all back`, with the helper text `Undoes every change above.` It also runs on unmount and on `pagehide`.

**Bench status line** (`role="status"`):

- At rest: `Nothing broken yet.`
- One change live: `1 change live. Watch the corner.`
- Several changes live: `{n} changes live. Watch the corner.`
- Below 1100 px, the second sentence becomes `Open the panel to see them.` Both strings are in the HTML and swapped by CSS.

**H3: `What to look for in the corner`**

- `The dot. Green is looking good, amber is some issues, red is needs help.` These are the widget's real `vibeLabel`s.
- `The list. Each problem is named in plain words. Switch the panel to technical mode for detector names and raw numbers.`
- `The marker. For element and image problems, VibeCheck pins a marker on the thing itself. Look at the review list or the photo.`
- Below 1100 px only: `Tap the pill to open the panel. Markers show while it's open.`

**The signature.** The page is ink on white, and the only colour at rest is the widget's green dot. Pressing `Render every review` or `Use the camera photo` produces, within seconds:

- the first red pixel on the page: the widget's marker on the exact list or photo;
- the verdict line flipping by one word, from `passes` to `doesn't pass`;
- one red dot on the Light row.

All three are earned by a fault the reader caused.

---

### 4.5 Decide (`#decide`)

- **H2:** `Nothing reaches your agent until you send it.`
- **Paragraph 1:** `Open a problem in the panel. You'll see what was measured, why it matters, and what to do about it, with two buttons under it: Send to agent and copy.`
- **Paragraph 2:** `Send to agent delivers that one issue to the coding agent watching your project. Copy puts the same prompt on your clipboard. A copied prompt isn't a delivery, and VibeCheck never counts it as one.`
- **Paragraph 3:** `No agent is connected to this website, so Send to agent stays off here, and the panel's Fix tab says "AI connection not set up". In your own project it turns on once the hub is running and one agent session is watching.` The strings are real: the vibe-mode tab label `Fix` and `AgentConnectionStatus` `unconfigured.vibe`.
- **H3:** `One agent per project`
- **Paragraph:** `Each project belongs to one agent session at a time. If a second session tries to watch it, that session is told who holds the project. It doesn't quietly take over.`
- **Link:** `What each delivery message means` → `/docs/concepts/issue-lifecycle#delivery`. The delivery-state list moves to docs (§9).
- **Optional figure:**
  - Source: `docs/screenshots/agent.png` (320×517), converted to WebP at 60 KB or less.
  - `width`/`height` set, `loading="lazy"`.
  - Caption: `Screenshot: the Fix tab in a connected project.`
  - Leave it out if it pushes the DOM budget over.

---

### 4.6 Fix (`#fix`)

- **H2:** `Your agent gets evidence, not a hunch.`
- **Paragraph:** `Your coding agent connects through a small MCP bridge and calls watch_for_issue for one project. Then it waits. When you press Send to agent, that call returns your issue with its evidence: which detector fired, the numbers, the element. The agent can ask get_fix_suggestions for a fix guide, edits your code, and calls resolve_issue. That call doesn't mark anything fixed. It asks the browser to check.`

**`RunRecording`** (replaces `RealAgentDemo`):

- Markup: `<video muted playsinline preload="none" width="1280" height="720" poster="/demo/run-poster.webp">`, with `<source src="/demo/run.webm" type="video/webm">` and `<source src="/demo/run.mp4" type="video/mp4">`.
- Controls are our own buttons: `Play recording` / `Pause` / `Replay`.
- It autoplays only when all of these hold: width at least 768 px, 50% in view, `prefers-reduced-motion: no-preference`, and no Save-Data. Otherwise it shows the poster and `Play recording`.
- **Chapters:** a list of text buttons that seek `currentTime`, read from `lib/recording/roundtrip-chapters.json`:
  - `DOM bloat appears`
  - `An agent claims the project`
  - `Send to agent`
  - `The agent receives it`
  - `The fix lands`
  - `Verifying`
  - `Fixed`
- **Caption** (14 px): `Recorded from the end-to-end test that runs before every release: the real widget and hub, installed from the packed npm packages, and a test client calling the same MCP tools Claude Code, Codex and Cursor call. The edit in the middle is a one-line toggle standing in for your agent's change. The send and the verification are real.`

**`RunTranscript`:**

- H3 `Transcript of the run above`.
- One light `<pre>` (`--vc-panel`, Geist Mono 14/22, `white-space: pre-wrap`), generated from `lib/recording/roundtrip-transcript.json`. That JSON is written by `demo-record.ts` from the actual `callTool` inputs and outputs. **Never type values by hand.**
- Shape (values in braces come from the run):

```
agent ▸ list_projects()
→ 1 project · {projectId} · widget connected
agent ▸ watch_for_issue({ project_id: "{projectId}" })
… waiting for an issue sent from the widget
→ received dom-bloat · error · "{issue.title}"
agent ▸ get_fix_suggestions({ project_id: "{projectId}", issue_id: "{id}" })
→ {first line of the suggestion}
agent ▸ resolve_issue({ project_id: "{projectId}", issue_id: "{id}" })
→ { "verifying": true, "projectId": "{projectId}", "issue_id": "{id}" }
panel  Verifying · waiting for two fresh snapshots
panel  Fixed · two snapshots without the issue
```

`watch_for_issue` returns the single queued issue plus `suggestion` and `receivedAt` (`mcpServer.ts:166-186`). `resolve_issue` returns `{ verifying: true, projectId, issue_id }` (`mcpServer.ts:200-210`).

- **Link:** `All ten MCP tools` → `/docs/reference/mcp-tools`. `packages/mcp/src/mcpServer.ts` registers exactly ten:
  - `list_projects`
  - `get_project_impact`
  - `get_performance_snapshot`
  - `get_detected_issues`
  - `get_fix_suggestions`
  - `watch_performance`
  - `watch_for_issue`
  - `acknowledge_issue`
  - `resolve_issue`
  - `release_project`

**Re-recording** (`e2e/mcp-roundtrip/demo-record.ts`):

- Set `colorScheme: 'light'`, replacing `'dark'` at line 94.
- Restyle the fixture's `?recording=1` shell to white, ink and system sans, and drop the radial green tint. The widget must be the only dark object in frame.
- Extend the run past the receipt, following the existing spec `persists a verified fix and reopens its regression` (`mcp-roundtrip.spec.ts:325`): apply the fix through the `useBloatedDom` toggle, call `resolve_issue`, wait for `Verifying`, then `Fixed`.
- Write `apps/web/public/demo/run.mp4`, `run.webm`, `run-poster.webp`, `apps/web/lib/recording/roundtrip-transcript.json` and `roundtrip-chapters.json`.
- **ffmpeg:**
  - MP4: `-c:v libx264 -crf 30 -preset slow -pix_fmt yuv420p -movflags +faststart -an`
  - WebM: `-c:v libvpx-vp9 -crf 38 -b:v 0 -an`
  - Poster: `-c:v libwebp -q:v 72`
- **Targets:** MP4 at 1.5 MB or less, poster at 80 KB or less.
- Note: `e2e/mcp-roundtrip/mcp-roundtrip.spec.ts` has uncommitted local changes. Coordinate with Radu before editing.

---

### 4.7 Confirm (`#confirm`)

- **H2:** `It's fixed when the page says it is.`
- **Paragraph:** `After resolve_issue, VibeCheck keeps measuring. When two fresh snapshots arrive without the problem, it's marked fixed. If the problem is still there, it goes back to the agent as unfinished. If it comes back after that, it's marked regressed, so you hear about it before anyone else does.` This matches `recordAbsentIssue` in `packages/mcp/src/workflow.ts:126-140` (two misses newer than the request), `verification-failed` and `regressed`.
- **`PhaseLine`** (Geist Mono 15 px, ink): line 1 `detected → sent → working → verifying → fixed`, line 2 `fixed → regressed`.
- **Caption** (14 px): `In the panel's plain-words mode these read To fix, Sent to AI, AI is working, Checking the fix, Fixed and Came back.` These are the real `VIBE_PHASE_LABELS` in `packages/react/src/panels/IssueProgress.tsx`.
- **Paragraph:** `You've seen a small version of this already. Put something back on this page and its row waits for two clean readings before it says passing again.` The link `Back to the readings` → `#look`.
- **H3:** `Every verified fix is written down`
- **Paragraph:** `Fixes, failed checks and regressions are kept in your project's .vibecheck/state.json. Read them with the stats command, or ask your agent to call get_project_impact.`
- **Code** (light block plus `CopyButton`): `npx -y @wcgw/vibe-check-mcp@{v} stats --project my-app --markdown`. The flag is `--markdown`, not `--format`.
- **Captured output:** a light `<pre>` with the real `stats --markdown` output from the same e2e run, written to `lib/recording/impact.md`. **Leave it out until it has been captured.** Never invent the numbers.

---

### 4.8 Your call (`#your-call`)

- **H2:** `Your call.`
- **Paragraph:** `Here's what VibeCheck measured on this page while you read. It won't make the call for you.`

**`YourCallCard`:**

- Boxed: 1px `--vc-line`, radius 12.
- Header (Geist 14 px, ink-3): `This page · vibecheck.wcgw.fun · {HH:MM}`. The time is client-only and its width is reserved.
- Five rows: vibe, state word, and the reading, plus the catch time when caught.

**Summary sentence** (Newsreader 400, lede scale). Pick the first variant that applies:

| Condition | Copy |
|---|---|
| Audits not settled | `The SEO and AEO audits are still running.` |
| Fails at rest on this device | `{Vibe} doesn't pass on your device: {vibe title}. That's a real reading.` |
| Something still caught | `{Vibe} is still caught: {vibe title}. Put it back, or leave it. It's your call.` |
| Reader broke things, all caught, all restored | `You broke {three} things on this page. VibeCheck caught all {three}, in {0.6 s}, {4.8 s} and {31 s}. Each one passed again on fresh readings.` |
| A fault the reader ran wasn't caught within 3× its `recheckMs` | `VibeCheck caught {two} of the {three}. {Fault label} wasn't caught in time. That's a real miss: report it on GitHub.` |
| Nothing broken | `You didn't break anything. The page passed all five on its own. That's the job.` |

**Actions:**

- `Copy this summary`. It copies plain text: URL, time, five lines of `Vibe: state (reading)`, and the summary sentence. Feedback is `Copied`, or `Couldn't copy. Select the text instead.`
- The text link `Run it on your own app` → `#install`.

There are no "It passes / Not yet" buttons and no score.

---

### 4.9 Install (`#install`)

- **H2:** `Run it on your own app.`
- **Paragraph:** `You need a React 18+ app, Node 20 or later, and Claude Code, Codex, or Cursor. It takes about five minutes.`

**`InstallSteps`:**

- Uses the shared `AgentPicker`.
- Every command comes from `MCP_PACKAGE_SPEC` and `getWatchInstruction` (re-exported by `@wcgw/vibe-check-core`, `src/index.ts:57-61`).
- Each code block is light with a `CopyButton`, and scrolls horizontally inside itself only.

1. **`Run setup in your project`**
   - Command: `npx -y @wcgw/vibe-check-mcp@{v} setup --agent {agent}`
   - Note: `Installs the widget, writes VibeCheckDevtools.tsx (in src/ when you have one), and registers the MCP bridge with your agent. Add --dry-run to see every step first.`
2. **`Mount it once, near your app root`**
   ```tsx
   import { VibeCheckDevtools } from './VibeCheckDevtools'

   export const Root = () => (
     <>
       <App />
       <VibeCheckDevtools />
     </>
   )
   ```
   - Note: `It renders nothing in production builds.` (`renderDevtoolsComponent`, `packages/mcp/src/setup.ts:133-146`)
3. **`Start the hub and leave it running`**
   - Command: `npx -y @wcgw/vibe-check-mcp@{v} up --project my-app --agent {agent}`
   - Note: `One hub on 127.0.0.1:4200 serves every project on your machine. Setup prints this exact command with your project id.`
4. **`Tell your agent to watch`**
   - Copy block with exactly `getWatchInstruction('my-app')`, which renders as: `Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "my-app" and keep waiting for the next issue I send from the widget.`
   - Copy feedback: `Copied. Paste it into your agent.`

**Aside** (14 px, ink-2): `Only want the overlay? Run npm i -D @wcgw/vibe-check, mount <PerfToggle />, and press Alt+Shift+V to show or hide it. No hub needed.`

**Closing:** `Then break something on purpose and press Send to agent. Want to see it on a broken app first? The repo includes Tidewell, a shop that fails every vibe on purpose:` followed by the code `pnpm install && pnpm --filter demo dev`.

**Links:**

- `Read the quickstart` → `/docs/quickstart`
- `See all ten MCP tools` → `/docs/reference/mcp-tools`
- `Fix a connection that won't go green` → `/docs/troubleshooting`
- `Copy a working setup: Next.js App Router or Vite + React` → `/docs/examples`

---

### 4.10 FAQ (`#faq`)

**H2:** `Straight answers.` Each question is a `<details>`/`<summary>`. The same data feeds the `FAQPage` JSON-LD and `/index.md`.

| Question | Answer |
|---|---|
| `Does anything leave my machine?` | `No. The widget sends snapshots to a hub on your own machine at 127.0.0.1:4200, and the hub talks only to the agent session you connected. There's no account and no hosted service.` |
| `Does it ship to production?` | `No. The component setup writes renders nothing when NODE_ENV is production.` |
| `Which agents does it work with?` | `Claude Code, Codex and Cursor, over MCP. One agent session holds one project at a time, so an issue never lands in the wrong chat.` |
| `Is this Lighthouse?` | `No. Lighthouse scores a page once, in a lab. VibeCheck watches the page while you build, names the defect, hands the one you pick to your agent, and checks the fix on fresh readings.` |
| `Which frameworks?` | `The overlay is for React 18 and later. The engine underneath has zero dependencies and runs on any page. Vue and Svelte overlays don't exist yet.` |
| `What does "fixed" mean?` | `Your agent can ask for verification. It can't declare victory. An issue is fixed when two newer snapshots stop showing it. If it comes back, it's marked regressed.` |

---

### 4.11 DOM budget (dom-bloat counts the whole document, the widget included)

- The current prerendered `/` is about 1,111 elements, which is already over the 800 warning. The judges measured this; I did not re-measure it [UNVERIFIED].
- **Target:**
  - SSR landing HTML is **520 elements or fewer**, `<head>` and Next script tags included.
  - Measure the expanded widget's element count `W` at 1440 on the Monitor tab. The total with the widget expanded must stay **under 800**.
  - If `W > 280`, cut first: the optional screenshot, then the `What it checks` detail lists (move them to `/docs/concepts/five-vibes` and keep only links).
- Use one `<pre>` for the transcript and plain text in the audit lists. No SVG on the landing except the 16 px brand mark.

---

## 5. Visual system

### 5.1 Tokens (`app/global.css`; replaces lines 9–140)

```css
.vc-landing, .vc-docs {
  /* canvas + ink (solid values; contrast on #fff noted) */
  --vc-bg: #ffffff;
  --vc-ink: #111112;        /* 18.9:1 */
  --vc-ink-2: #3a3a3c;      /* 11.3:1 */
  --vc-ink-3: #5c5c60;      /*  6.6:1, lightest allowed for text */
  --vc-ink-4: #8a8a8e;      /*  non-text only: rules, disabled borders */
  /* rules + surfaces */
  --vc-rule: #111112;       /* 1px section-opening rule */
  --vc-line: #e3e3e6;       /* hairline borders */
  --vc-line-2: #efeff1;     /* row dividers */
  --vc-panel: #f5f5f6;      /* code, transcript, agent-read view */
  --vc-panel-2: #ededef;    /* hover fill, fault banners */
  /* semantic state only, always paired with a word */
  --vc-ok: #15803d;         /* not used on the landing; kept for /scan and /fix verdicts */
  --vc-amber: #a16207;      /* re-checking */
  --vc-sig: #c0362c;        /* caught */
  --vc-focus: #111112;
  /* type */
  --vc-serif: var(--vc-font-serif), ui-serif, Georgia, 'Times New Roman', serif;
  --vc-sans: var(--vc-font-sans), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --vc-mono: var(--vc-font-mono), ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  /* space */
  --vc-s1: 4px; --vc-s2: 8px; --vc-s3: 12px; --vc-s4: 16px; --vc-s5: 24px;
  --vc-s6: 32px; --vc-s7: 48px; --vc-s8: 64px; --vc-s9: 96px; --vc-s10: 128px;
  --vc-section-pad: clamp(72px, 51.2px + 5.33vw, 128px);
  --vc-gutter-widget: 400px;
  --vc-radius-sm: 8px; --vc-radius-lg: 12px;
}
.vc-landing { color-scheme: light; background: var(--vc-bg); color: var(--vc-ink); font-family: var(--vc-sans); }
```

**Delete:**

- `--vc-proof-c/m/y/k` in all four blocks;
- `--vc-sig-bg`, `--vc-amber-bg` and `--vc-ok-bg`;
- the `@media (prefers-color-scheme: dark)` block **and** the `.dark` / `[data-theme]` overrides **for `.vc-landing`**.

Keep a `.dark .vc-docs` block for the docs toggle:

- canvas `#0c0c0d`
- ink `#ededee`
- ink-3 `#a1a1a6`
- line `rgba(255,255,255,.12)`
- panel `#151517`
- status `#4ade80` / `#fbbf24` / `#f87171`

### 5.2 Fonts (`apps/web/app/fonts.ts`, `next/font/google`, self-hosted at build)

```ts
import { Newsreader, Geist, Geist_Mono } from 'next/font/google'

export const serif = Newsreader({
  subsets: ['latin'], weight: ['400', '500'], style: ['normal'],
  display: 'swap', variable: '--vc-font-serif', preload: true, adjustFontFallback: true,
})
export const sans = Geist({
  subsets: ['latin'], weight: ['400', '500', '600'],
  display: 'swap', variable: '--vc-font-sans', preload: true,
})
export const mono = Geist_Mono({
  subsets: ['latin'], weight: ['400', '500'],
  display: 'swap', variable: '--vc-font-mono', preload: false,
})
```

- Apply `${serif.variable} ${sans.variable} ${mono.variable}` on `<html>` in `app/layout.tsx`.
- **Do not** pass `axes: ['opsz']`.
- **Budget:** every woff2 must be **under 100 KB transfer**. `resource-bloat` counts `css`/`link` initiators against its 100 KB production threshold (`packages/core/src/detectors/resourceBloat.ts:22,36-37`). Measure them [UNVERIFIED sizes].
- **Fallback if Newsreader is over budget:** keep it for H1 and H2 only (weight 500) and set the lede and prose in `ui-serif, Georgia`.

### 5.3 Type scale (px; clamp interpolates linearly between 390 and 1440)

| Role | Face, weight | 390 | 768 | 1440 | Line height | Tracking | CSS |
|---|---|---|---|---|---|---|---|
| H1 | Newsreader 500 | 40 | 54 | 80 | 1.05 | −0.025em | `clamp(40px, 25.14px + 3.81vw, 80px)`; `text-wrap: balance`; max 14em |
| H2 | Newsreader 500 | 30 | 38 | 52 | 1.08 | −0.02em | `clamp(30px, 21.83px + 2.095vw, 52px)`; max 18em |
| Verdict line | Newsreader 500 | 24 | 28 | 34 | 1.2 | −0.015em | `clamp(24px, 20.29px + 0.952vw, 34px)` |
| Ledger vibe name | Newsreader 500 | 24 | 27 | 32 | 1.15 | −0.015em | `clamp(24px, 21.03px + 0.762vw, 32px)` |
| Loop step name | Newsreader 500 | 22 | 24 | 26 | 1.2 | −0.01em | `clamp(22px, 20.51px + 0.381vw, 26px)` |
| Lede | Newsreader 400 | 20 | 21 | 24 | 1.5 | −0.005em | `clamp(20px, 18.51px + 0.381vw, 24px)`; max 34em |
| Prose / claim | Newsreader 400 | 18 | 19 | 19 | 1.6 | 0 | max 36rem |
| H3 | Geist 600 | 18 | 18 | 20 | 1.4 | −0.01em | |
| Kicker | Geist 500 | 15 | 15 | 15 | 1.45 | 0 | ink-3, sentence case |
| UI, buttons, nav | Geist 500 | 15 | 15 | 15 | 1.33 | 0 | |
| Reading | Geist Mono 500, tabular | 15 | 16 | 16 | 1.5 | 0 | `font-variant-numeric: tabular-nums` |
| Code, transcript | Geist Mono 400 | 14 | 14 | 15 | 1.6 | 0 | |
| Caption, meta | Geist 400 | 14 | 14 | 15 | 1.5 | 0 | ink-3 |

The floor is 14 px for any readable text. This retires all 75 sub-14 px declarations and the inline 11.5 px note. There are no all-caps labels.

### 5.4 Grid and spacing

- **At 1100 px and up:**
  - `.vc-wrap` has a 48 px left margin and `margin-right: var(--vc-gutter-widget)` (400 px). That is today's CLS-safe first-paint default.
  - The reading column is at most 720 px.
  - The hero and H1 may run to 880 px.
  - Under `:root[data-vc-widget='collapsed']` the column centres at a 1080 px maximum. This only follows a user action, so it is CLS-exempt.
- **768–1099 px:** single column, 40 px side padding, at most 680 px. No gutter; the widget is collapsed.
- **Below 768 px:** 20 px side padding. `main` gets `padding-bottom: 96px` so the pill never covers the last control.
- **Rhythm:**
  - section `padding-block: var(--vc-section-pad)`
  - rule to H2: 32 px
  - H2 to body: 24 px
  - paragraph gap: 1em
  - ledger row: min 72 px tall, 20 px vertical padding

**Rules and boxes:**

- Each section opens with a 1px `--vc-rule` line across the content width.
- Ledger and loop rows use 1px `--vc-line-2`.
- **Only `FaultBench` and `YourCallCard` are boxed.**
- Code blocks: `--vc-panel` background, 1px `--vc-line`, radius 8.
- No shadows, no tinted sections, no gradients.

### 5.5 Controls

- **Primary button (outlined):**
  - 1.5px solid `--vc-ink`, `#fff` fill, ink text, radius 8
  - height 44 px on desktop, 48 px below 768 px; padding `0 18px`
  - Geist 500, 15 px
  - hover fill `--vc-panel-2`; `:active` is `translateY(1px)`
  - `:focus-visible` is a 2px `--vc-focus` outline, offset 2 px
- **Disabled:** border `--vc-ink-4`, text `--vc-ink-3`. The reason is shown as visible inline text (14 px) and linked by `aria-describedby`. Never a tooltip only.
- **Text link:** ink, underline 1px, offset 3 px.
- **Dots:** 8 px circles, amber or red only, always next to a word.

### 5.6 Staging the dark widget

- It is the only dark surface and the only fixed element on `/`.
- Nothing else uses a fill darker than `--vc-panel-2`. Code, transcript, poster and recording shell are all light.
- At 1100 px and up the gutter is empty white. The only thing pointing at the widget is the hero margin note.
- The widget keeps its default `dark` theme. `storageKey="vibecheck-site"`.

### 5.7 Dark mode

- `/`, `/scan` and `/fix` are **light only** (`color-scheme: light`).
- `/docs` keeps the Fumadocs toggle with **light as the default**: `RootProvider theme={{ defaultTheme: 'light', enableSystem: false }}` [UNVERIFIED prop shape in fumadocs-ui 16.10.7].
- The widget isn't mounted on docs pages.

### 5.8 Motion (CSS plus one IntersectionObserver for the video; no animation library)

- No scroll reveals. All content is visible without JS, which also keeps AEO `content-requires-js` passing.
- Readings update in place with no tweening.
- State words crossfade over 160 ms, `cubic-bezier(.2,.7,.2,1)`.
- Verdict change: 180 ms crossfade with a 4 px rise. Height is reserved.
- Re-check progress: a 1px ink line, `transform: scaleX()`, over `recheckMs`.
- Buttons: 120 ms transitions.
- The live ring breathes at 2 s.
- The transcript renders complete and does not type itself.
- Under `prefers-reduced-motion: reduce`: every transition is 0 ms, the ring is static, the progress line becomes text, there is no video autoplay, and no smooth scroll.

### 5.9 Accessibility

- One `<h1>`.
- Landmarks: `header`, `main#main`, `footer`.
- Exactly two live regions: the verdict line and the bench status.
- Faults use `aria-pressed`.
- Hit areas are at least 44 px below 768 px.
- Every colour is paired with a word.
- Focus order follows reading order.
- Keyboard: all controls reachable. The menu drawer traps focus and closes on Escape.

### 5.10 `app/global.css`: what to delete and keep (line numbers are as of today, 3,232 lines)

| Lines | Block | Action |
|---|---|---|
| 1–3 | tailwind and fumadocs imports | **Keep** |
| 9–140 | tokens | **Rewrite** per §5.1 |
| 142–169 | shell and widget gutter | **Keep**; switch to the `--vc-gutter-widget` token |
| 170–406 | eyebrow, `.vc-proof-header`, control strips, `[data-vc-crop-ticks]`, registration constellation | **Delete** |
| 407–445 | section head | **Delete**; replace with `.vc-step-head` |
| 446–608 | live gauges | **Delete**; replace with `.vc-ledger*` |
| 609–693 | real-demo GIF figure | **Rewrite** as `.vc-recording` |
| 694–720 | hero | **Rewrite** per the type scale |
| 721–781 | install command | **Rewrite** as `.vc-setup-line` and `.vc-code` |
| 782–829 | buttons | **Rewrite** as outlined, §5.5 |
| 830–898 | break rack and sink | **Rewrite** as `.vc-bench`, `#vc-reviews`, `#vc-photo`, `#vc-banner-slot` |
| 899–957 | cards | **Delete** |
| 958–1026 | prose | **Rewrite** in Newsreader |
| 1027–1052 | CTA row | **Rewrite** |
| 1053–1095 | footer | **Rewrite** as `.vc-footer` |
| 1096–1543 | `SiteSidebar` (used by `/fix`) | **Keep**, minus: rail marks (~1139–1170); the "fault-red tick" on the active row (~1286), where active becomes bold ink plus the `--vc-panel` pill; the small-caps group label (~1346), which becomes sentence case at 14 px; the mobile proof furniture and boundary marks (~1356–1390). Move the mobile drawer (~1413–1543) to a shared `.vc-drawer` used by `SiteMenu`, with 44 px hit areas. |
| 1544–1621 | Fumadocs `#nd-sidebar` overrides | **Keep**; delete the "rosette + proof version" rules (~1610–1621) and use `SiteVersion` |
| 1622–2232 | `/fix` article, catch panel, steps, FAQ, severity chip, framework picker, code, hub | **Keep**; apply the 14 px floor; remove any decorative red |
| 2233–2268 | diagram kit `.vc-dg` | **Keep** (docs) |
| 2269–2403 | scripted terminal | **Delete** |
| 2404–2472 | detector card "fire" | **Delete** |
| 2473–2634 | audit columns | **Delete**; replace with `.vc-audit-list` |
| 2635–2855 | `/scan` and leaderboards | **Keep**; 14 px floor |
| 2856–2880 | pipeline layouts | **Keep** (docs; updated diagram) |
| 2881–2913 | issueArt sizing | **Keep** for `/fix` only; drop the landing `.vc-art` |
| 2914–3232 | Bestiary specimen plates | **Delete** |

---

## 6. Metadata and machine-readable surfaces

| Surface | Final value |
|---|---|
| Root layout `title.default` | `VibeCheck — performance and SEO overlay for AI-built apps` (57 chars); template `%s · VibeCheck` |
| Landing `title` | `{ absolute: 'VibeCheck — performance and SEO overlay for AI-built apps' }`. Use `absolute`, or the template would make it 69 chars and trip `title-too-long`. |
| Meta description (landing and root) | `A dev overlay that checks your AI-built frontend for jank, bloat, leaks and SEO/AEO gaps, sends the issue you pick to your coding agent, and verifies the fix.` (158 chars) |
| OG and Twitter title | `Your agent built it. You decide if it ships.` |
| OG and Twitter description | the meta description |
| Twitter card | `summary_large_image` |
| Canonical and alternates | `/`, plus `text/markdown` → `/index.md` (kept) |

**OG image** (`app/opengraph-image.tsx`, 1200×630):

- White background; content inset 72 px.
- Top left: circle-check mark plus `VibeCheck` in Geist 600, 34 px, ink.
- Headline in Newsreader 500, 76 px, line height 1.05, two lines, ink: `Your agent built it.` / `You decide if it ships.`
- Sub-line in Geist 400, 28 px, `#5c5c60`: `A performance and SEO overlay that sends the issue you pick to your coding agent, and verifies the fix.`
- Bottom left: `vibecheck.wcgw.fun` in Geist Mono 22 px, ink-3.
- No colour, no widget mock.
- Bundle the TTFs under `app/og-fonts/` (OFL).
- `lib/problems/og.tsx` (fix pages): keep the structure, apply the same type, and remove proof styling.

**JSON-LD graph** (`app/page.tsx`):

- `DATE_MODIFIED = '2026-10-26'`. `datePublished` stays as it is.
- `SoftwareApplication`:
  - `name: 'VibeCheck'`
  - `applicationCategory: 'DeveloperApplication'`
  - `operatingSystem: 'macOS, Linux, Windows (Node.js 20+)'`
  - `softwareVersion: '{v}'`
  - `description` = the meta description
  - `url`
  - `downloadUrl: 'https://www.npmjs.com/package/@wcgw/vibe-check'`
  - `license: 'https://opensource.org/licenses/MIT'`
  - `offers` price `0`
  - `author` → `#radu`
  - `datePublished` and `dateModified`
- `WebSite` (name, url, description).
- `WebPage` (`/`, `dateModified`, `author` → `#radu`).
- `Person` `#radu`: `name: 'Radu Ceuca'`, `url: 'https://github.com/raduceuca'`.
- **`FAQPage`** built from the §4.10 data.

**Markdown and text views:**

- **`/index.md`** (`lib/markdown/landing.ts`) is **generated from `LANDING_COPY`**: H1, lede, then each section's H2 and body in page order, the five vibes as a list (name: claim), install steps with commands, then the FAQ. Hand-written prose is no longer allowed.
- **`llms.txt` summary line** (blockquote): `> VibeCheck is a performance and SEO overlay for AI-built frontends. It runs in the corner of your dev server, names jank, bloat, leaks and SEO/AEO gaps on the live page, sends the one issue you pick to the coding agent watching your project over MCP, and counts a fix only when fresh browser readings confirm it.` Apply the same in `llms-full.txt` and replace "nine tools" with "ten tools".

**`public/.well-known/mcp.json`:**

- Generated at `prebuild` by `apps/web/scripts/gen-mcp-card.mjs` from a new `MCP_TOOL_CATALOG` exported by `@wcgw/vibe-check-protocol`. `mcpServer.ts` registers its descriptions from that same catalog.
- Fields:
  - `version: '{v}'`
  - `homepage: 'https://vibecheck.wcgw.fun'`
  - `documentation: 'https://vibecheck.wcgw.fun/docs'`
  - `transport.args: ['-y', '@wcgw/vibe-check-mcp@{v}', 'connect']`
  - all **10** tools
  - `resolve_issue` described as `Request browser-evidence verification after fixing an issue in one project`
- Drop `vibecheck.dev` and `0.1.0`.

**Root layout:**

- Replace "quiet performance instrument" and "caught what it broke" everywhere.
- Keep `authors`, `creator` and `publisher`.

**Other files:**

- `sitemap.ts`: add `/scan`.
- `robots.ts`: unchanged; it allows the AI crawlers.

---

## 7. Other site surfaces

**`/scan`:**

- Top bar shell.
- H1: `Check any public page for Findable and Quotable.`
- Lede: `Paste a URL. VibeCheck fetches the page's HTML and runs the SEO and AEO audits on it: 19 SEO criteria and 9 AEO checks, with every miss in plain words and a link to its fix guide.`
- Keep the form, the SSRF guard and the boards.
- Pass verdicts may use `--vc-ok` with the word `Pass`.

**`/fix`:**

- Keeps the sidebar.
- Add a `vibe` field (`'smooth' | 'light' | 'clean' | 'findable' | 'quotable'`) to `lib/problems/types.ts` and every problem, and show it as a text chip (`Vibe: Light`, ink on `--vc-panel`, 14 px).
- URLs are unchanged.
- Counts read `19 SEO criteria (20 checks)` everywhere.
- issueArt glyphs become monotone `currentColor`.

---

## 8. Showcase

### 8.1 `demo/` becomes **Tidewell**, a fictional small-batch ceramics shop

**Premise.** The storefront an agent produces from one prompt ("make a shop for my ceramics studio with a hero, products, reviews and a newsletter"), with every common vibe-coding fault built in.

**Look:**

- A neutral light UI: white, ink and a system serif for product names.
- Colour comes only from product photography: four to eight images generated with `gen-asset` / `nano-banana-pro`, of fictional mugs and glazes, stored locally under `demo/public/images/`.
- No picsum, no `jsonplaceholder`.

**Identity:**

- Project id: `tidewell`. Mount through a `src/VibeCheckDevtools.tsx` identical to `renderDevtoolsComponent('tidewell')`.
- Footer: `Tidewell is a made-up shop, built badly on purpose to show VibeCheck. Every flaw on it is real.`

**Remove:**

- the "Trusted by teams at Vercel, Stripe, Linear, Notion, Figma" bar;
- "What 10,000+ teams say";
- the stats;
- the "vibe-check 0.3.0 what's new" band;
- the `jsonplaceholder` calls.

Reviews are product reviews of mugs from first-name-only reviewers, with no star totals and no counts.

**Sections, in order:**

1. `PromoBar`
2. `Header` (wordmark `Tidewell`, nav `Shop · Glazes · Journal · Visit`, `MiniCart`)
3. `Hero` (`Mugs that hold the heat.`, CTA `Shop the spring glazes`)
4. `ProductGrid` (`Spring glazes`, eight products, each with a `Ships by {date}` line)
5. `GlazePicker` (`Pick a glaze`)
6. `StockTicker` (`Only {n} left in Tide Blue`)
7. `Reviews` (`What people say about the Harbor mug`)
8. `RecentlyViewed`
9. `Newsletter` (`Get the kiln schedule`)
10. `Footer`

**Two layers:**

1. **`demo/src/shop/*` is broken by default in source.** There is one file per fault, each marked `// VIBECHECK-FAULT: <detector>`. This is what a real agent edits during an actual Send → fix → verify loop. `git checkout demo/src/shop` re-breaks it.
2. **`demo/src/shop/fixed/*` holds the reference fixes,** labelled in the UI as `Reference fix (not your agent's)`. The scenario drawer chooses which implementation runs.

**Fault map** (all 13 detectors and all five vibes):

| Vibe | File | Fault, as shipped | Trips | Reference fix |
|---|---|---|---|---|
| Smooth | `shop/LateBanners.tsx` | `PromoBar`, `ShippingNotice` and `NewsletterInvite` mount at 1200, 1350 and 1500 ms after load, with no reserved space | `layout-thrashing` (3 shifts within 500 ms, no recent input) | reserved min-heights |
| Smooth | `public/vendor/configurator.js`, loaded by `shop/GlazePicker.tsx` | On load and on each glaze change, six 130 ms busy tasks spaced 200 ms apart, run from its own file | `long-task-attribution` (Chrome and Edge) | work split into `requestIdleCallback` chunks |
| Smooth | `shop/StockTicker.tsx` | `setState` every 50 ms at the page root | FPS reading only (collector) | update once a minute, local state |
| Light | `shop/Reviews.tsx` | renders all 2,000 reviews (about 6,000 elements) | `dom-bloat` (error) | windowed list of 20 with "Show more", no dependency |
| Light | `shop/Header.tsx`, `shop/MiniCart.tsx` | both `fetch('/api/cart.json')` on mount | `duplicate-requests` | one module-level promise cache |
| Light | `shop/RecentlyViewed.tsx` | a module-level array grows by 100,000 numbers per second (capped at 120 MB) and adds a `resize` listener on every render without removing it | `memory-leak` (Chrome and Edge) | bounded `RingBuffer(12)` from core, plus listener cleanup |
| Light | `shop/Hero.tsx` | `/images/hero-4000.jpg` (about 2.4 MB) in a 640 px box, no `width`/`height` | `large-images` (error), `unoptimized-images` | 1600w AVIF/WebP `srcset` (about 180 KB), dimensions set |
| Light | `shop/ProductGrid.tsx` | 1600 px product shots in 280 px cards, no dimensions, no `loading="lazy"` | `unoptimized-images` | `srcset`, dimensions, `loading="lazy"` |
| Light | `shop/ShipsBy.tsx` plus `index.html` script tag | `<script src="/vendor/moment.min.js">` for one "Ships by" date (sets `window.moment`; the script pattern `moment.min.js` also matches) | `heavy-library` | `Intl.DateTimeFormat` |
| Light | `shop/ProductSearch.tsx` | statically imports `shop/data/catalog-full.json` (about 700 KB, generated by `demo/scripts/gen-catalog.mjs` from fictional products) | `resource-bloat` in dev (500 KB threshold) [UNVERIFIED that Vite dev transfer exceeds it] | dynamic `import()` on first search |
| Clean | `shop/CartPoller.tsx` | `console.log('[cart] polling', …)` every 300 ms | `console-spam` | silent, polls every 60 s |
| Clean | `index.html` (broken template) | no `<link rel="icon">`, no `lang`; charset and viewport kept | `web-essentials` | complete head |
| Findable | `index.html` plus `shop/*` | `<title>Vite + React</title>`; no description, OG, Twitter or canonical; two `<h1>`s; images without `alt`; "Click here" links; no sitemap | `seo` (`title-default` and others) | full head, one h1, alt text, descriptive links, `sitemap.xml` |
| Quotable | template plus middleware | no JSON-LD, no `<main>`, no author or date, empty SPA shell, no `llms.txt`, `robots.txt` disallows `GPTBot`, no markdown view. The MCP card stays absent in both modes; it is info-level and optional, which teaches "you decide what to send". | `aeo` | `Store`/`Product` JSON-LD, `<main>`, author meta, prerendered text in `#root`, `llms.txt`, crawlers allowed, `Accept: text/markdown` view |

**Server-side switching** (`demo/vite.config.ts`; our own plugin, no dependency):

- A `configureServer` middleware reads the `tidewell_fixed` cookie (comma list of vibes) and chooses `index.html` (broken) or `index.fixed.html`, passing it through `server.transformIndexHtml` [UNVERIFIED in Vite 8].
- It serves `/robots.txt`, `/sitemap.xml`, `/llms.txt` and the `Accept: text/markdown` response to match.
- It sets `Cache-Control: no-store` on `/images/hero-4000.jpg`. Otherwise a 304 revalidation gives `transferSize` close to 0 and `large-images` misses repeat views.

**Scenario drawer** (`demo/src/scenario/ScenarioDrawer.tsx`):

- Light, bottom-left, so it stays away from the widget's bottom-right. Text is 14 px or larger. It collapses to a 44 px `Scenario` button.
- Header: `Tidewell is made up. Every flaw on it is real.`
- Master segmented control: `As the agent shipped it` / `With reference fixes`.
- Five vibe rows, each with a `Broken` / `Fixed` toggle, expandable to individual faults.
- `applies on reload` badges on the head, server and script faults (essentials, Findable, Quotable, heavy-library, long-task, resource-bloat). Toggling one of those offers `Reload now`.
- State lives in the URL (`?fixed=smooth,light`), mirrored into the cookie.
- Presets: `?scenario=broken` and `?scenario=fixed` for recordings.

**Demo README, "Fix it with your agent":**

1. `pnpm install && pnpm --filter demo dev`
2. `npx -y @wcgw/vibe-check-mcp@{v} up --project tidewell --agent claude-code`
3. Paste the watch instruction for `tidewell` into your agent.
4. In the panel, press **Send to agent** on "Your page still has a placeholder title".
5. Watch **Verifying**, then **Fixed**.

**Consent and hosting:**

- Vendoring `moment.min.js` (MIT) into `demo/public/vendor/` is third-party code. Propose it in one line and get `[ok-to-add-dep]` first.
- Optional public hosting at `demo.vibecheck.wcgw.fun` needs Radu's go-ahead and uses an `X-Robots-Tag: noindex` header. A noindex meta tag would trip seo `noindex` in the fixed state.

**Recording:** keep the e2e fixture (`e2e/mcp-roundtrip/fixtures`) separate from Tidewell so the tests stay stable.

### 8.2 Integration examples (new `examples/`; add `examples/*` to `pnpm-workspace.yaml`)

New workspace packages that declare `vite`, `next`, `@vitejs/plugin-react` and so on count as adding dependencies. Use the same versions the repo already uses, and propose them first with `[ok-to-add-dep]`.

**`examples/vite-react/`: the honest SPA**

- `package.json`: `private: true`, `type: module`. `react`/`react-dom` `^19.2.4`, `@wcgw/vibe-check: workspace:*`. Dev: `vite ^8.0.1`, `@vitejs/plugin-react ^6.0.1`, `typescript ~5.9.3`, `@types/react*`.
- `index.html`:
  - `lang="en"`, charset, viewport, `<link rel="icon" href="/favicon.svg">`
  - title `A small Vite and React example for VibeCheck`
  - description; canonical `https://example.com/` (the README says to replace it)
  - OG title, description, image and URL; `twitter:card`
  - `<meta name="author">`
  - static JSON-LD (`WebPage` with `author` and `dateModified`)
- `src/main.tsx`: mounts `<App/>` and `<VibeCheckDevtools/>`.
- `src/VibeCheckDevtools.tsx`: verbatim `renderDevtoolsComponent('vite-react-example')`.
- `src/App.tsx`: `<main>`, one `<h1>`, and a short article with descriptive links.
- `public/`: `favicon.svg`, `robots.txt` (allow all, with a `Sitemap:` line), `sitemap.xml`, `llms.txt`, `og.png` (60 KB or less).
- **Expected at rest:** Smooth, Light and Clean pass; Findable 19 of 19; Quotable **6 of 9**. The three misses:
  - `content-requires-js` (warning): SPA;
  - `markdown-negotiation-missing` (info): static host;
  - `mcp-discovery-missing` (info): optional.
  The README explains each one and links `/fix/content-requires-javascript`.
- **README:** four commands (install, `setup` or the manual mount, `up --project vite-react-example`, the watch instruction) and the expected-readings table.

**`examples/next-app-router/`: what passing looks like**

- `package.json`: `next 16.2.10`, `react`/`react-dom ^19.2.4`, `@wcgw/vibe-check: workspace:*`.
- `next.config.mjs`: a rewrite with `has: [{ type: 'header', key: 'accept', value: '(.*)text/markdown(.*)' }]` → `/md`. Copy the pattern from `apps/web/lib/markdown-rewrites.mjs`; don't import it.
- `app/layout.tsx`:
  - `<html lang="en">`
  - `metadata`: title template, description, `alternates.canonical`, `openGraph` with images, `twitter`, `authors`
  - mounts `<DevVibeCheck/>`
- `app/dev-vibe-check.tsx`: `'use client'`; `next/dynamic(() => import('./VibeCheckDevtools').then(m => m.VibeCheckDevtools), { ssr: false })`.
- `app/VibeCheckDevtools.tsx`: verbatim setup output (`next-example`). It returns null in production.
- `app/page.tsx`: `<main>`, one `<h1>`, JSON-LD (`WebPage` plus `Person` author, `dateModified`).
- Also: `app/robots.ts` (allows `GPTBot` and the others), `app/sitemap.ts`, `app/llms.txt/route.ts`, `app/md/route.ts` (`text/markdown`), `app/icon.svg`, `app/opengraph-image.png`.
- **Expected in `next dev`:** all five vibes pass except Quotable **8 of 9**. `mcp-discovery-missing` is info-level and optional for a site without an MCP server, and we don't invent one. The pill reads `1 problem`; the README says why.
- **Risk:** Next dev chunks may exceed the 500 KB dev `resource-bloat` threshold [UNVERIFIED]. If they do, that's a detector false positive to fix in core (for example, excluding framework dev chunks). Don't hide it in the example.

**CI smoke** (`e2e/mcp-roundtrip/site/examples.spec.ts`):

- Use the Playwright already in `e2e/mcp-roundtrip` with a separate `playwright.site.config.ts`, so no new dependency.
- Install the packed tarballs into each example (reuse `installFixture`), run its dev server, and wait 12 s.
- Assert the pill aria-label (`Expand vibe check — {fps} fps, {n} problem(s)`, vibe mode):
  - vite-react: 3 problems, exactly the three documented checks;
  - next-app-router: 1 problem, `mcp-discovery-missing`.

---

## 9. Docs touchpoints (Fumadocs stays)

**Tool count.** It must equal what `packages/mcp/src/mcpServer.ts` registers: **10**. Fix every mismatch:

- `content/docs/index.mdx:36` ("six MCP tools")
- `how-it-works.mdx:19` ("nine tools")
- `ai-agents/overview.mdx:29` ("The nine tools" becomes "The ten tools"; list all ten)
- `ai-agents/cursor.mdx:7` ("nine")

Generate `reference/mcp-tools.mdx` from `MCP_TOOL_CATALOG`.

**Versions.**

- Replace hard-coded `@0.3.0` in `quickstart.mdx` (78, 89, 99), `troubleshooting.mdx` (24, 60, 61), `integration/nextjs.mdx` (74) and `ai-agents/cursor.mdx` (8) with an MDX `<McpSpec/>` (and `<McpCommand args="up --project my-app" />`) that reads `MCP_PACKAGE_SPEC`.
- Use the protocol's exact client commands: Claude Code is `claude mcp add --scope local vibe-check -- npx -y {spec} connect`.

**`index.mdx`:**

- Description: `What VibeCheck checks, and how you stay in control of what reaches your agent.`
- Lead with the four-step loop (§4.3 wording).
- Add a **five vibes table** (vibe, claim, detectors).
- Replace the pipeline with: widget → hub (`127.0.0.1:4200`) → stdio bridge → one leased agent, with **You: Send to agent** and **verify: two fresh snapshots** marked.
- Drop "performance conscience" and "the human never opened DevTools".
- Cards: Quickstart · The five vibes · Issue lifecycle · MCP tools.

**`quickstart.mdx`**, retitled **`Your first vibe check`**:

1. Run setup (Fumadocs `Tabs`: Claude Code / Codex / Cursor)
2. Mount once
3. Start the hub (`up`)
4. Tell your agent to watch (exact `getWatchInstruction`)
5. Notice: break one thing on purpose
6. Decide: press **Send to agent** (the `agent.png` screenshot, labelled as a screenshot)
7. Confirm: **Verifying**, then **Fixed**, and what **Regressed** means

Add a "Done when" checklist using the widget's real labels:

- button: `Send to agent` → `Sent` → `With agent` → `Verifying`
- phase: `Fixed`

Keep the manual hub path second.

**New pages:**

- `concepts/five-vibes.mdx`: detectors grouped by vibe, generated from `vibes.generated.ts`. Smooth explicitly includes the frame-rate, long-frame and web-vitals collectors.
- `docs/examples.mdx`: Tidewell, Next App Router and Vite + React, with run commands and the expected readings.

**`concepts/issue-lifecycle.mdx`:**

- Add `## Delivery` (anchor `#delivery`) with the exact `DELIVERY_LABEL` strings (`sent`, `agent not watching`, `queue full`, `MCP server offline`, `invalid issue`, `send failed`, `MCP not configured`) and what each means.
- State that `resolve_issue` requests verification and marks nothing fixed.

**`reference/detectors`:**

- Teach `pnpm gen:docs` to group by vibe.
- Describe `layout-thrashing` as "clusters of unexpected layout shifts", not forced reflow.
- Use `19 SEO criteria (20 checks)`.

**`PipelineDiagram`** (used by `how-it-works.mdx` and `architecture.mdx`) becomes `LoopDiagram`. Stations:

1. `The panel notices`
2. **`You press Send to agent`** (2px ink border; not filled)
3. `Your agent receives one issue (watch_for_issue)`
4. `It fixes and asks to verify (resolve_issue)`
5. `The browser confirms: two fresh snapshots, then Fixed`

A dashed return edge reads `Comes back later → Regressed`. Monotone.

**Docs typography:** Newsreader for the page H1 only; Geist 16/26 body; Geist Mono code; 14 px floor; light by default.

**`README.md`** (root): rewrite the tagline line 11 ("live press check") in plain product language, using the hero lede.

---

## 10. Tests and acceptance

### 10.1 Update or delete

| File | Change |
|---|---|
| `apps/web/vitest.config.ts` | `include: ['components/**/*.test.tsx', '__tests__/**/*.test.{ts,tsx}', 'lib/**/*.test.ts']`. Today `__tests__/real-agent-demo.test.tsx` and `markdown-rewrites.test.ts` never run. The environment stays `node`; tests use `renderToStaticMarkup`. |
| `components/landing/landingCopy.test.tsx` | Rewrite: exact H1 lines, kicker, every H2 from §4, the footer lead, title at 60 chars or fewer, description at 160 or fewer, OG title. |
| `components/landing/proofSurfaces.test.tsx` → `landingSurfaces.test.tsx` | Keep the regression guards: no crop ticks, rail or calibration marks. Retarget to `StepHead` and `VibeLedger`. |
| `components/site/SidebarProofMarks.test.tsx` → `SiteNav.test.tsx` | Keep the assertions (two shells, docs footer "Resources"). Raise the burger and close hit areas to 44 px. Add a top-bar test: links and `Install`. |
| `components/brand/NavigationBrand.test.tsx` | Keep. Assert no `.vc-side-brand-2` split, and that `SiteVersion` renders `v{v}` from `MCP_PACKAGE_SPEC`. |
| `components/brand/ProofMarks.test.tsx` | **Delete**, with the component. |
| `components/issueArt/issueArt.test.tsx` | **Invert**: every glyph uses `currentColor`; no `data-vc-process-plate`; no `--vc-proof-`. |
| `__tests__/real-agent-demo.test.tsx` → `run-recording.test.tsx` | Poster by default, `Play recording`, `preload="none"`, no `.gif`, reduced motion means no autoplay, caption contains `test client`. |
| `__tests__/production-domain.test.mjs` | Extend to `public/.well-known/mcp.json`: `vibecheck.wcgw.fun`, no `vibecheck.dev`. |

### 10.2 Add

| File | Asserts |
|---|---|
| `apps/web/lib/vibes.test.ts` | `gradeVibes`: FPS never fails; CLS fails Smooth only without a bench fault; an incomplete audit is never a pass; each detector maps to exactly one vibe (13 in total). |
| `apps/web/components/landing/faults/registry.test.ts` | Every fault has `expects`, `recheckMs` and an `available()` reason string. Layout-fault shift times: three within 500 ms, the first at 600 ms or later. `Panel shows` equals `getSuggestion(fixture, 'vibe').title`. Leak cap is 30 s or 64 MB. |
| `apps/web/__tests__/metadata.test.ts` | Landing `title.absolute` at 60 chars or fewer; description 160 or fewer; `DATE_MODIFIED === '2026-10-26'`; JSON-LD contains `FAQPage`, `SoftwareApplication` and `Person`. |
| `apps/web/__tests__/landing-markdown.test.ts` | `/index.md` is generated from `LANDING_COPY` and contains the H1 and every H2. |
| `apps/web/__tests__/commands.test.ts` | Every command string in `landingCopy` and `InstallSteps` is built from `MCP_PACKAGE_SPEC`/`getWatchInstruction`; no `@latest`, no literal version. |
| `apps/web/__tests__/dom-budget.test.mjs` (runs after `next build`) | Parse `.next/server/app/index.html` with `linkedom`: 520 elements or fewer. |
| `scripts/__tests__/banned-copy.test.ts` | §10.3 grep guard. |
| `scripts/__tests__/type-floor.test.ts` | No `font-size` below 14 px in `apps/web/app/global.css` or inline styles under `apps/web/components/landing/**`, except lines tagged `/* vc-allow-small: non-text */`. |
| `scripts/__tests__/mcp-catalog.test.ts` | The tools registered in `mcpServer.ts` equal `MCP_TOOL_CATALOG` names (10); `public/.well-known/mcp.json` lists the same 10 with `connect` args and version `{v}`; site and docs say "ten". |
| `scripts/__tests__/version-sync.test.ts` | R0. |
| Core tests | P1, P2, P3 (§1). |
| React test | P4, if approved. |
| `e2e/mcp-roundtrip/site/site-dogfood.spec.ts` (with `playwright.site.config.ts`; `webServer`: `pnpm --filter web build && pnpm --filter web start -p 3100`) | §10.4 |
| `e2e/mcp-roundtrip/site/examples.spec.ts` | §8.2 |

### 10.3 Banned-words grep guard

**Case-insensitive JavaScript regexes:**

```
(?<![\w-])proofs?(?![\w-])
press[- ]?check
misprints?
(?<![\w-])plates?(?![\w-])
\b(in|out of) register\b
registration (mark|target|cross)
crop[- ]?ticks?
\bCMYK\b
pulled the proof
quiet performance instrument
caught what it broke
performance conscience
\b(six|nine) (MCP )?tools\b
Slop Bestiary
\bmenace\b
\bspecimens?\b
Trusted by
\bused by\b
\d{1,3}(,\d{3})+\+ (teams|users|customers|developers)
```

**Scope:**

- `apps/web/lib/landingCopy.ts`, `apps/web/lib/markdown/**`
- `apps/web/app/**/*.{ts,tsx,css}`, `apps/web/app/llms*.txt/**`
- `apps/web/components/**/*.tsx`
- `apps/web/content/docs/**/*.mdx`
- `apps/web/public/.well-known/mcp.json`
- `README.md`, `packages/*/README.md`
- `demo/index.html`, `demo/src/**`
- `examples/**`

**Excluded:** `*.test.*` and `__tests__/**`.

**Before landing it,** rename the identifiers `ProofVersion` → `SiteVersion` and any "stop-proof" wording → "stop-safe".

### 10.4 Acceptance criteria

All of these run on a **production build** (`next build && next start`), and once on `pnpm cf:preview` (Workers runtime), in a real browser at **390, 768 and 1440 px**. Radu's rule: jsdom alone doesn't count.

1. **Passes at rest** (after 12 s idle, at every width):
   - pill or widget aria-label contains `0 problems`;
   - `[data-vc-verdict="pass"]`;
   - every ledger row reads `Passing`;
   - Findable `19 of 19`, Quotable `9 of 9`;
   - no `duplicate-requests` issue after `Run the audits again` (P1).
2. **Each fault** shows its `Panel shows` title in the widget's Problems list and the matching row state `Caught: …`. Faults with an unavailable reason are skipped on non-Chromium browsers, and the reason text is visible.
3. **Undo** returns the row to `Passing again` within `recheckMs + 2 s`. `Put it all back` returns the page to `0 problems`.
4. **DOM:** SSR is 520 elements or fewer; the total with the widget expanded at 1440 is under 800.
5. **CLS at load is 0.00** at every width, including a returning visitor with the widget collapsed (head-script guard). No horizontal scroll at 390 (`scrollWidth <= innerWidth`).
6. **Nothing on `/` is fixed-position except the widget.** No element other than the widget has a background darker than `#ededef`.
7. **Copy and style:**
   - The §10.3 guard passes with zero matches.
   - The type-floor test passes.
   - The DOM has exactly one `<h1>`.
   - The first red pixel on `/` only appears after a fault [manual check].
8. **Machine surfaces:**
   - `/index.md` returns `text/markdown` with the H1.
   - `Accept: text/markdown` on `/` returns markdown.
   - `/llms.txt` contains the new summary.
   - `mcp.json` lists 10 tools.
   - The sitemap includes `/scan`.
9. **Performance sanity** (Lighthouse in Chrome DevTools, or a one-off `npx lighthouse`, which needs no repo dependency):

   | Check | Target |
   |---|---|
   | Mobile Performance score | 90 or higher |
   | Desktop Performance score | 95 or higher |
   | Accessibility score | 95 or higher |
   | SEO score | 100 |
   | Best Practices score | 95 or higher |
   | LCP (mobile, simulated) | 2.5 s or less |
   | TBT | 200 ms or less |
   | CLS | 0 |
   | Largest JS or CSS transfer | under 100 KB (our own `resource-bloat` would otherwise flag the page) |
   | Each font file | under 100 KB |
   | Image bytes at rest | 150 KB or less; nothing at or above 500 KB until a fault runs |
   | Video | `preload="none"` |

   Confirm the 96 KB mdast/unist async chunk never loads on `/` [UNVERIFIED].
10. **Docs:** every command renders with `{v}`; the tool count reads "ten" everywhere; a light theme is the default.

**Accepted cost.** "Make the layout jump" creates real CLS in the visitor's own session, which may show up in CrUX field data for vibecheck.wcgw.fun [UNVERIFIED]. It is deliberate and only follows a click. If p75 CLS degrades after launch, put the fault behind a second confirmation.

---

## 11. Video handoff (for the Claude motion film)

**Key lines** (use these exact strings; nothing new):

1. `Your agent built it.`
2. `You decide if it ships.`
3. `This page passes the vibe check.` → `This page doesn't pass the vibe check.`
4. `Now break it the way agents do.`
5. `Nothing reaches your agent until you send it.`
6. `It's fixed when the page says it is.` (or `Nobody marked it fixed. The browser did.`, only if P4 ships)
7. `Smooth. Light. Clean. Findable. Quotable.`
8. End card: `Keep building fast. Keep the final say.` + `npx -y @wcgw/vibe-check-mcp@{v} setup --agent claude-code` + `vibecheck.wcgw.fun`

**Shots** (about 40 s, 16:9 at 1920×1080, with 1:1 and 9:16 cuts):

| # | Time | Shot |
|---|---|---|
| 1 | 0–4 s | White canvas. The H1 sets line by line in Newsreader, single ink. No logo yet. |
| 2 | 4–8 s | The dark widget slides into the bottom-right corner, the only dark object, green dot, `looking good`. |
| 3 | 8–12 s | The ledger's five rows resolve to `Passing`; the verdict line reads `This page passes the vibe check.` |
| 4 | 12–18 s | The cursor presses `Render every review`. Rows fill the bounded box. The first red appears: the widget's marker on the list, and one red dot on Light. The verdict flips by one word. Hold a beat on that calm page with one red mark. |
| 5 | 18–28 s | **Real footage** from `run.mp4`, captioned `Recorded from the end-to-end test`: `Send to agent` → `Sent` → `With agent` → the fix toggles → `Verifying` → `Fixed`. Never re-animate this part as if it were live. |
| 6 | 28–34 s | The five vibe words stack, one per beat, ink on white, each with its claim as a sub-line. |
| 7 | 34–40 s | End card: closing line, the setup command in Geist Mono on `#f5f5f6`, and the domain. |

**Visual language:**

- **Colour:** `#ffffff` canvas; inks `#111112` / `#3a3a3c` / `#5c5c60`; surfaces `#f5f5f6` and `#ededef`. Green appears only inside the widget. Red appears only on the caught fault. Amber only for re-checking.
- **Type:** Newsreader 500 for headlines (tracking −0.025em), Geist for UI, Geist Mono for readings and commands.
- **Shapes and motion:** 1px ink rules, no shadows. `cubic-bezier(.2,.7,.2,1)`, 160–420 ms. Numbers cut in place, never count up.
- **Labelling:** animated segments carry a small `Animated explainer` label (14 px equivalent). Recorded segments carry `Recorded from the end-to-end test`.
- **Sources:** capture the real page and Tidewell (`?scenario=broken` / `?scenario=fixed`) rather than drawing mock UI. Any widget shown must be the real widget.

**Banned in the film:**

- print or proof motifs;
- gradients, glow or glass;
- particle or "AI" sparkle;
- logos of other companies, stars or counts;
- stock whooshes;
- a fake "Sent".

**Audio:** optional. A soft, single-instrument bed and silent UI; no voice-over claims beyond the key lines.

---

## 12. Open decisions and consent gates (for Radu)

1. **R0.** The version number and the publish. The site deploys only after it.
2. **P4.** No-hub `mark as fixed` → `dismiss` (widget product change).
3. **Dependencies:** the `examples/*` workspace packages (Next, Vite and their plugins) and the vendored `moment.min.js` in the demo. Each needs `[ok-to-add-dep]`.
4. **Product copy:** the layout-thrashing vibe title `Page layout keeps recalculating` doesn't match what it measures (shift clusters). Suggested: `The page keeps jumping around`. The site reads it from `getSuggestion`, so a change flows through automatically.
5. **Product question:** should info-level AEO checks (MCP card) count in the pill's problem count? Today they do, so the Next example reads `1 problem`.
6. **Product follow-up (not blocking):** `large-images` ignores cached images (`transferSize === 0`). It could fall back to `encodedBodySize`.
7. **Optional hosting:** a public Tidewell demo.
8. **Optional phase 2:** `Connect my local hub` from the public site. The hub sends no Private-Network header (`hubServer.ts:44-46`), so it is blocked on a browser test against Chrome's local-network permission.

---

## 13. Build order

1. **Core and protocol:** P1, P2, P3, `MCP_TOOL_CATALOG`, the version-sync test. P4 if approved. Then R0 (Radu publishes).
2. **Site foundation:** tokens, fonts and the `global.css` deletions (§5.10); `SiteTopBar`, `SiteMenu` and `SiteFooter`; icons; the 14 px floor test.
3. **Live layer:** `LiveEngineProvider` with the stop-safe handle, `gradeVibes`, `lib/audit.ts`.
4. **Landing sections** §4.1–4.10, with `LANDING_COPY` as the single source; then the markdown, llms, OG, JSON-LD and `mcp.json` generation.
5. **Fault infrastructure** (probe route, `fault-block.js`, `IMG_4032.jpg`) and `FaultBench`.
6. **Recording:** re-shoot in a light shell through verification; transcript and chapters JSON; delete the GIF.
7. **Docs** (§9).
8. **Tidewell demo** (§8.1).
9. **Examples** (§8.2), after the dependency consent.
10. **Tests and gates** (§10). Verify in a real browser at 390, 768 and 1440 on `next start` and `cf:preview`.
11. **Video** (§11), using the real page, Tidewell and `run.mp4`.
