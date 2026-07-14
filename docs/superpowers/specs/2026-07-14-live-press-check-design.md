# Live Press Check: Copy and Proof-Weight Design

**Date:** 2026-07-14
**Status:** Approved direction, implementation pending

## Objective

Make the printing-press proof system unmistakable in both the public site and the widget. The current visual marks are tasteful but too quiet, and the landing copy does not explain why they are there. This pass will strengthen the marks and carry a coherent printing-press world through the page while keeping the literal product promise clear: VibeCheck catches performance and discoverability defects in AI-built frontends and gives the evidence back to the coding agent.

## Creative Direction

The product is a **live press check for an AI-built frontend**.

The metaphor maps cleanly onto the product:

- A browser run is a press pass.
- The live widget is the proof sheet.
- Performance and discoverability issues are defects that slipped through the first pass.
- Collectors are control readings.
- Detected issues are proof marks.
- MCP carries the marked-up proof back to the coding agent.
- A fix is the correction made before the next pass.

The printing language should feel operational, not nostalgic. The interface stays modern: soft radii, fine rules, contemporary typography, generous space, and small technical annotations. There will be no heavy outlined rectangles, fake paper textures, vintage ornaments, or cartoon press machinery.

## Copy Principles

1. **Metaphor plus literal meaning.** Every important press reference must sit beside a plain statement about performance, discoverability, evidence, or agent correction.
2. **A complete world, not scattered puns.** Press language appears in the hero, section titles, transitions, live-state microcopy, and footer so the system reads intentionally.
3. **No misleading preflight claim.** VibeCheck is continuous, so the central phrase is “live press check,” not “proof before publish.”
4. **Keep useful technical terms.** FPS, memory, SEO, AEO, MCP, audits, and issue names remain literal.
5. **Humor stays dry.** The best lines should feel like printer’s annotations, not ad copy performing cleverness.

## Landing Page Copy

### Metadata

**Page title**

`VibeCheck — the live press check for AI-built frontends`

**Meta description**

`A live press check for AI-built frontends. Catch performance and discoverability defects, then hand the marked-up evidence back to your coding agent.`

### Hero

**Eyebrow**

`VibeCheck · live press check · AI-built frontend`

**Headline**

> Your agent shipped it.
> VibeCheck pulled the proof.

**Lede**

> A live press check for the AI-built frontend. VibeCheck reads every pass for jank, leaks, DOM bloat, layout shift, and discoverability defects—then hands the marked-up evidence back to your coding agent before those mistakes harden into production.

**Live note**

> The proof in the bottom-right is live—it is reading this page now.

The install command remains unchanged. It is already the page’s clearest primary action.

### Plate 01: Problem

**Title:** `What slips through the first pass`

**Sub-label:** `before the ink dries`

**Paragraph 1**

> The first pass can look clean and still be wrong. An AI agent ships a frontend that holds together in the happy path, then leaks memory across routes, bloats the DOM to 10k nodes, fires the same request eight times, janks on scroll, shifts as assets load, and quietly disappears from search and answer engines. The screen looked finished. Nobody pulled a proof.

**Paragraph 2**

> **VibeCheck is the press check your coding agent was missing.** It watches each run like a printer reads a proof sheet: measuring the page, marking the defects, and returning exact evidence through MCP so the agent can correct the next pass.

### Plate 02: Fault Demo

**Title:** `Pull a bad proof`

**Sub-label:** `make the defects visible`

**Intro**

> These are not mockups. Each control deliberately throws part of this page out of register: memory, DOM size, layout, requests, or the console. The live proof in the corner marks the fault within seconds. Clear the proof when you are done and the page returns to register.

**Reset control:** `Clear the proof`

**Calm state:** `Proof is clean. Introduce a fault above; the live press check will mark it within seconds.`

### Plate 03: Live Measurements

**Title:** `Every pass, measured`

**Sub-label:** `live control strip`

**Intro**

> A press operator does not judge a run by sight alone; the control strip tells the truth. VibeCheck does the same for the browser, continuously reading frame health, main-thread stalls, JS-heap memory, and Core Web Vitals from this page. These are live measurements, not a mockup.

**Gauge header:** `Live proof · this page, right now`

**Gauge note:** `read from the same collectors the widget ships`

**Closing transition**

> Those are the control readings. On top of them, VibeCheck identifies thirteen recurring defects by name and marks the exact evidence your agent needs for the correction.

### Plate 04: Bestiary and Audits

**Title:** `The Slop Bestiary`

**Sub-label:** `thirteen recurring misprints`

**Intro**

> A specimen drawer of the defects AI agents keep putting back into circulation. Each card names the culprit, records how it slips into the run, and shows the exact proof mark VibeCheck emits when it catches one.

**Audit heading:** `Pull a discoverability proof`

**Audit copy**

> Two specimens—`seo` and `aeo`—run as pass/fail press checks. Pull a proof of the page you are reading and see what search crawlers and answer engines actually receive, misses included.

**Audit button:** `Run the SEO / AEO press check`

**Scan link:** `Run a press check on any URL →`

### Plate 05: Agent Loop

**Title:** `From proof mark to fix`

**Sub-label:** `the correction loop`

**Intro**

> A useful proof does more than say something is wrong. The widget captures the reading, sends it to the local MCP server, and gives your coding agent the marked evidence it needs to propose the correction.

**Demo transition**

> Here is an illustrative correction loop as your agent sees it: a defect is marked, the evidence travels over MCP, a diff is proposed, and the next pass returns to register. The public demo stays local-only. Put it through the press:

The existing suggested agent prompt remains literal and unchanged.

### Plate 06: Installation

**Title:** `Install the press check`

**Sub-label:** `two blocks`

**First subheading:** `Mount the live proof`

**Second subheading:** `Connect the correction loop`

**Closing copy**

> Nine project-scoped MCP tools, an `llms.txt`, and a Claude skill ship with the press check. The widget marks the defects; your agent gets the evidence.

**Quickstart link:** `Set up the press check in five minutes →`

### Footer

> **Pull a proof before you call it done.**
> Zero runtime deps in core · open source · MIT.

## Widget Microcopy

The widget should participate in the world without renaming established technical concepts.

- Keep `LIVE PROOF`, `READ / SAMPLE`, `CHK 01`, `CHK 02`, and `PL 01/06`.
- Change the monitor issue heading from `problems` to `proof marks`.
- Keep `fix with AI →`; it is clearer than a metaphorical alternative.
- Keep audit names, navigation labels, metric names, severity labels, and issue titles literal.
- Calm and fault state semantics remain unchanged.

## Navigation Brand Furniture

The desktop sidebar and mobile top bar share one revised wordmark treatment.

### Press symbol

Replace the generic green status dot with an 18px **registration rosette** drawn as a dedicated SVG component:

- Cyan, magenta, and black registration circles use sub-pixel plate offsets.
- A black crosshair and center point hold the symbol together at small sizes.
- The mark is decorative inside the home link; `VibeCheck home` remains the accessible label.
- The rosette is a brand mark, not a health indicator, so it does not change with performance state.

This is a print-production symbol rather than a pictorial cartoon of a press. It stays sharp at 18px and belongs to the same visual language as the hero and widget marks.

### Wordmark

- Change the visible text from lowercase `vibecheck` to the properly cased `VibeCheck`.
- `Vibe` uses the primary ink color and `Check` uses the secondary ink color.
- Keep the current contemporary sans-serif weight and spacing; do not introduce a display or retro typeface.

### Version notation

Replace the fault-red rounded badge with the press notation `PROOF 0.2.0`:

- No capsule, fill, colored border, or fault-red text.
- Use muted monospaced 9px text with tracked uppercase `PROOF` and tabular version numerals.
- Separate the notation from the wordmark with a 16px neutral hairline.
- Use the same wording in the sidebar footer so version information is consistent.

The version should read as an edition/proof identifier, never as a validation error or alert.

## Visual Weight System

Color proof bars become materially thicker everywhere they appear, with a clear hierarchy:

| Use | Current | New target |
|---|---:|---:|
| Public-site hero control strip | 4px | 7px |
| Expanded widget top register | 3px | 5px |
| Collapsed widget register | 2px | 4px |
| Bestiary specimen strip | 3px | 4px |

Registration and crop marks adopt these explicit sizes:

- Site header registration target: 16px to 22px.
- Site header crop tick: 10px to 13px.
- Expanded widget target: 11px to 14px.
- Expanded widget crop tick: 8px to 11px.
- Collapsed widget target: 6px to 8px.
- Large registration constellation: 78px to 88px.

The proof bars retain varied patch widths; only their vertical weight increases. CMYK remains the only decorative color system. Faulted states keep the same plate-separation behavior, with cyan and magenta horizontal separation increasing from 0.75px to 1px and the yellow vertical offset increasing from 0.6px to 0.8px.

## Responsive Behavior

- The thicker hero strip must remain on one line at 320px-wide viewports.
- The header rule absorbs width pressure before labels or marks shrink.
- The collapsed widget register stays clear of the status dot, primary metrics, and issue count.
- Larger registration targets remain decorative and non-interactive.
- No new horizontal overflow is permitted.

## Accessibility

- Decorative print furniture stays `aria-hidden`.
- Metaphorical visible labels never replace accessible technical names where clarity matters.
- The copy does not rely on color or the press metaphor to explain product behavior.
- Existing focus targets and hit areas do not shrink.
- Reduced-motion mode still removes plate-separation transforms and proof echoes.

## Testing

1. Update proof-control tests to assert the new semantic weight variants rather than fragile raw layout snapshots.
2. Add landing-copy tests for the hero promise, all six section titles, the audit CTA, and footer line.
3. Update the fault-demo test for `Clear the proof`.
4. Update widget tests for the `proof marks` heading.
5. Add navigation tests for the `VibeCheck` wordmark, registration rosette, and `PROOF 0.2.0` notation.
6. Run React and web test suites, TypeScript linting, and the full production build.
7. Inspect desktop and mobile layouts in a real browser, including expanded and collapsed widget states.

## Success Criteria

- A first-time visitor can explain why the interface uses printing proof marks after reading the hero.
- The printing metaphor remains present through the complete landing-page argument.
- Performance, discoverability, MCP evidence, and agent correction remain explicit.
- Every CMYK proof bar is visibly thicker than before.
- Registration and crop marks read without hunting for them.
- The navigation presents `VibeCheck` in proper case with a recognizably print-production symbol.
- Version `0.2.0` reads as a proof identifier rather than an error badge.
- The interface still feels modern, restrained, and technically credible.
