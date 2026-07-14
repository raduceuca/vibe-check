# Live Press Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn VibeCheck’s proof marks and landing copy into one unmistakable live printing-press check system while preserving the modern interface.

**Architecture:** Keep decorative primitives isolated in the existing brand/proof modules. Add one small navigation-brand module for the registration rosette, proper-case wordmark, and proof-version notation; keep copy landmarks in a typed constant shared by the landing page and its client components. Increase proof weight through the existing CSS tokens and inline widget primitives without changing interaction geometry.

**Tech Stack:** TypeScript, React 18+, Next.js App Router, inline styles in `@wcgw/vibe-check`, site CSS in `apps/web/app/global.css`, Vitest, Testing Library, tsup.

## Global Constraints

- React package UI must continue to use inline styles only.
- No heavy outlined rectangles, fake paper textures, vintage ornaments, retro typefaces, or cartoon press machinery.
- CMYK remains the only decorative color system.
- Hero proof bars are 7px; expanded widget bars 5px; collapsed widget and Bestiary bars 4px.
- Site header target is 22px; site crop ticks 13px; expanded widget target 14px; expanded widget crop tick 11px; collapsed widget target 8px; registration constellation 88px.
- Visible wordmark is exactly `VibeCheck`; version notation is exactly `PROOF 0.2.0` for the current package version.
- Press metaphors must remain adjacent to literal performance, discoverability, MCP, or agent-correction language.
- Decorative marks remain `aria-hidden`; accessible technical names and hit targets do not change.
- Preserve user-owned untracked files in the repository root.

---

## File Map

- Create `apps/web/components/brand/NavigationBrand.tsx` — reusable rosette, wordmark, and proof-version furniture.
- Create `apps/web/components/brand/NavigationBrand.test.tsx` — brand markup and semantics.
- Modify `apps/web/components/site/SiteSidebar.tsx` — consume the shared navigation brand furniture.
- Modify `apps/web/components/brand/ProofMarks.tsx` — expose semantic proof weight on the site control strip.
- Modify `apps/web/components/brand/ProofMarks.test.tsx` — verify semantic proof weight.
- Modify `apps/web/app/global.css` — navigation brand styling and stronger proof furniture.
- Modify `packages/react/src/panels/ui/ProofMarks.tsx` — stronger expanded/collapsed widget proof controls.
- Modify `packages/react/src/panels/ui/ProofMarks.test.tsx` — exact widget weight and target tests.
- Modify `packages/react/src/theme.ts` — stronger faulted plate separation.
- Create `apps/web/lib/landingCopy.ts` — typed landing-page copy landmarks and microcopy.
- Create `apps/web/lib/landingCopy.test.tsx` — copy, metadata length, and rendered CTA tests.
- Modify `apps/web/app/page.tsx` — full live-press-check page argument.
- Modify `apps/web/components/landing/BreakThisPage.tsx` — proof-oriented demo reset and status copy.
- Modify `apps/web/components/landing/LiveGauges.tsx` — live-proof header microcopy.
- Modify `apps/web/components/landing/AuditThisPage.tsx` — press-check CTA microcopy.
- Modify `packages/react/src/panels/monitor/MonitorView.tsx` — rename the monitor’s problem heading to `proof marks` in vibe mode.
- Modify `packages/react/src/panels/monitor/MonitorProofDetails.test.tsx` — verify widget press microcopy.

---

### Task 1: Navigation Press Identity

**Files:**
- Create: `apps/web/components/brand/NavigationBrand.tsx`
- Create: `apps/web/components/brand/NavigationBrand.test.tsx`
- Modify: `apps/web/components/site/SiteSidebar.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Produces: `PressRosette(): JSX.Element`, `NavigationWordmark(): JSX.Element`, `ProofVersion({ version }: { readonly version: string }): JSX.Element`.
- Consumes: existing `--vc-proof-*`, `--vc-ink*`, `--vc-line*`, and mono/sans tokens.

- [ ] **Step 1: Write the failing brand test**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NavigationWordmark, ProofVersion } from './NavigationBrand'

describe('navigation brand', () => {
  it('uses a print-production rosette and proper-case wordmark', () => {
    const markup = renderToStaticMarkup(<NavigationWordmark />)
    expect(markup).toContain('data-vc-press-rosette')
    expect(markup).toContain('Vibe')
    expect(markup).toContain('Check')
    expect(markup).not.toContain('vc-side-brand-dot')
  })

  it('presents the version as a proof notation', () => {
    const markup = renderToStaticMarkup(<ProofVersion version="0.2.0" />)
    expect(markup).toContain('data-vc-proof-version')
    expect(markup).toContain('PROOF')
    expect(markup).toContain('0.2.0')
    expect(markup).not.toContain('vc-side-ver-badge')
  })
})
```

- [ ] **Step 2: Run the test and verify red**

Run: `pnpm --filter web exec vitest run components/brand/NavigationBrand.test.tsx`

Expected: FAIL because `NavigationBrand` does not exist.

- [ ] **Step 3: Implement the navigation brand primitives**

Create `NavigationBrand.tsx` with this public structure:

```tsx
import Link from 'next/link'

export const PressRosette = () => (
  <svg data-vc-press-rosette viewBox="0 0 20 20" aria-hidden="true" focusable="false">
    <g className="vc-press-rosette-c"><circle cx="10" cy="10" r="5.5" /></g>
    <g className="vc-press-rosette-m"><circle cx="10" cy="10" r="5.5" /></g>
    <g className="vc-press-rosette-k">
      <circle cx="10" cy="10" r="5.5" />
      <circle cx="10" cy="10" r="1.5" />
      <path d="M1 10h18M10 1v18" />
    </g>
  </svg>
)

export const NavigationWordmark = () => (
  <Link href="/" className="vc-side-brand" aria-label="VibeCheck home">
    <PressRosette />
    <span className="vc-side-brand-name">
      Vibe<span className="vc-side-brand-2">Check</span>
    </span>
  </Link>
)

export const ProofVersion = ({ version }: { readonly version: string }) => (
  <span className="vc-proof-version" data-vc-proof-version="">
    <span className="vc-proof-version-rule" aria-hidden="true" />
    <span className="vc-proof-version-label">PROOF</span>
    <span>{version}</span>
  </span>
)
```

In `SiteSidebar.tsx`, delete the internal `Wordmark`, import the new components, render `NavigationWordmark` in all three existing locations, and render `ProofVersion` in both top bars and `SidebarFooter`.

Replace the old dot/badge CSS with:

```css
[data-vc-press-rosette] {
  width: 18px;
  height: 18px;
  overflow: visible;
  fill: none;
  flex: none;
}
.vc-press-rosette-c { stroke: var(--vc-proof-c); transform: translate(-0.5px, 0.25px); }
.vc-press-rosette-m { stroke: var(--vc-proof-m); transform: translate(0.5px, -0.25px); }
.vc-press-rosette-k { stroke: var(--vc-proof-k); }
[data-vc-press-rosette] g { stroke-width: 0.8; vector-effect: non-scaling-stroke; }
.vc-proof-version {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: var(--vc-mono);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
  color: var(--vc-ink-4);
  white-space: nowrap;
}
.vc-proof-version-rule { width: 16px; height: 1px; background: var(--vc-line-strong); }
.vc-proof-version-label { letter-spacing: 0.13em; }
```

- [ ] **Step 4: Run focused tests and web lint**

Run: `pnpm --filter web exec vitest run components/brand/NavigationBrand.test.tsx && pnpm --filter web lint`

Expected: 2 tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/brand/NavigationBrand.tsx apps/web/components/brand/NavigationBrand.test.tsx apps/web/components/site/SiteSidebar.tsx apps/web/app/global.css
git commit -m "feat(site): add press-check navigation identity"
```

---

### Task 2: Stronger Widget Proof Furniture

**Files:**
- Modify: `packages/react/src/panels/ui/ProofMarks.tsx`
- Modify: `packages/react/src/panels/ui/ProofMarks.test.tsx`
- Modify: `packages/react/src/theme.ts`

**Interfaces:**
- Preserves: `ProofControlStrip`, `RegistrationTarget`, `CropTicks`, `TopProofRegister`, and `PillProofRegister` exports.
- Adds: `data-wcgw-proof-weight="standard|compact"` to `ProofControlStrip`.

- [ ] **Step 1: Extend the failing widget tests**

```tsx
it('uses five-pixel standard and four-pixel compact proof weights', () => {
  const standard = render(<ProofControlStrip />).container.firstElementChild as HTMLElement
  const compact = render(<ProofControlStrip compact />).container.firstElementChild as HTMLElement
  expect(standard.dataset.wcgwProofWeight).toBe('standard')
  expect(standard.style.height).toBe('5px')
  expect(compact.dataset.wcgwProofWeight).toBe('compact')
  expect(compact.style.height).toBe('4px')
})

it('uses larger top and pill registration targets', () => {
  const top = render(<TopProofRegister />).container
  const pill = render(<PillProofRegister />).container
  expect(top.querySelector('[data-wcgw-registration-target]')?.getAttribute('width')).toBe('14')
  expect(pill.querySelector('[data-wcgw-registration-target]')?.getAttribute('width')).toBe('8')
})
```

- [ ] **Step 2: Run the test and verify red**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/panels/ui/ProofMarks.test.tsx`

Expected: FAIL on old 3px/2px heights and 11px/6px targets.

- [ ] **Step 3: Implement the widget weights**

In `ProofControlStrip`, set:

```tsx
data-wcgw-proof-weight={compact ? 'compact' : 'standard'}
style={{
  display: 'inline-flex',
  alignItems: 'center',
  gap: compact ? 0.75 : 1,
  height: compact ? 4 : 5,
  flexShrink: 0,
  pointerEvents: 'none',
}}
```

Change `CropTicks` to accept `size?: number` and render that size. Use `size={11}` in `TopProofRegister` and `size={8}` in `PillProofRegister`. Set the top target to `14`, pill target to `8`, and top register height to `16`.

In `theme.ts`, set the fault separations exactly:

```css
[data-wcgw-proof-control][data-faulted="true"] [data-wcgw-proof-ink="c"] { transform: translate(-1px,0.4px); }
[data-wcgw-proof-control][data-faulted="true"] [data-wcgw-proof-ink="m"] { transform: translate(1px,-0.4px); }
[data-wcgw-proof-control][data-faulted="true"] [data-wcgw-proof-ink="y"] { transform: translate(0.3px,0.8px); }
```

- [ ] **Step 4: Run the React package checks**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all React tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/panels/ui/ProofMarks.tsx packages/react/src/panels/ui/ProofMarks.test.tsx packages/react/src/theme.ts
git commit -m "feat(widget): strengthen proof control weights"
```

---

### Task 3: Stronger Public-Site Proof Furniture

**Files:**
- Modify: `apps/web/components/brand/ProofMarks.tsx`
- Modify: `apps/web/components/brand/ProofMarks.test.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Preserves all current `ProofMarks.tsx` exports.
- Adds: `data-vc-proof-weight="hero"` to `ProofControlStrip`.

- [ ] **Step 1: Add the failing semantic-weight assertion**

```tsx
it('marks the public control strip as the seven-pixel hero weight', () => {
  const markup = renderToStaticMarkup(<ProofControlStrip />)
  expect(markup).toContain('data-vc-proof-weight="hero"')
})
```

- [ ] **Step 2: Run the test and verify red**

Run: `pnpm --filter web exec vitest run components/brand/ProofMarks.test.tsx`

Expected: FAIL because the weight attribute is missing.

- [ ] **Step 3: Apply stronger public proof sizes**

Add `data-vc-proof-weight="hero"` to `ProofControlStrip`. Update CSS values exactly:

```css
.vc-proof-control-strip { height: 8px; }
.vc-proof-control-strip i { height: 7px; }
.vc-proof-header-target, [data-vc-registration-target] { width: 22px; height: 22px; }
[data-vc-crop-ticks] { width: 13px; height: 13px; }
[data-vc-crop-ticks] i:first-child { width: 13px; }
[data-vc-crop-ticks] i:last-child { height: 13px; }
.vc-registration-constellation { width: 88px; height: 88px; }
.vc-spec-foot::before { width: 52px; height: 4px; opacity: 0.84; }
```

Increase `.vc-proof-header` minimum height to `22px` so the larger furniture does not collide with the eyebrow.

- [ ] **Step 4: Run site proof tests and lint**

Run: `pnpm --filter web exec vitest run components/brand/ProofMarks.test.tsx && pnpm --filter web lint`

Expected: all focused tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/brand/ProofMarks.tsx apps/web/components/brand/ProofMarks.test.tsx apps/web/app/global.css
git commit -m "feat(site): increase proof mark visibility"
```

---

### Task 4: Live Press Check Landing Copy

**Files:**
- Create: `apps/web/lib/landingCopy.ts`
- Create: `apps/web/lib/landingCopy.test.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/landing/BreakThisPage.tsx`
- Modify: `apps/web/components/landing/LiveGauges.tsx`
- Modify: `apps/web/components/landing/AuditThisPage.tsx`

**Interfaces:**
- Produces: `LANDING_COPY`, a readonly object containing metadata, hero, section heading, demo, gauge, audit, install, and footer landmarks.
- Consumes: the exact approved prose in `docs/superpowers/specs/2026-07-14-live-press-check-design.md`.

- [ ] **Step 1: Write failing copy tests**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AuditThisPage } from '@/components/landing/AuditThisPage'
import { BreakThisPage } from '@/components/landing/BreakThisPage'
import { LANDING_COPY } from './landingCopy'

describe('live press check copy', () => {
  it('keeps the metadata literal and within search limits', () => {
    expect(LANDING_COPY.metaDescription.length).toBeLessThanOrEqual(160)
    expect(LANDING_COPY.metaDescription).toContain('performance and discoverability defects')
  })

  it('carries the press world through all six plates', () => {
    expect(LANDING_COPY.hero.headline).toEqual([
      'Your agent shipped it.',
      'VibeCheck pulled the proof.',
    ])
    expect(Object.values(LANDING_COPY.sections).map((section) => section.title)).toEqual([
      'What slips through the first pass',
      'Pull a bad proof',
      'Every pass, measured',
      'The Slop Bestiary',
      'From proof mark to fix',
      'Install the press check',
    ])
    expect(LANDING_COPY.footerLead).toBe('Pull a proof before you call it done.')
  })

  it('uses proof language in the live controls', () => {
    expect(renderToStaticMarkup(<BreakThisPage />)).toContain('Clear the proof')
    expect(renderToStaticMarkup(<AuditThisPage />)).toContain('Run the SEO / AEO press check')
  })
})
```

- [ ] **Step 2: Run the copy test and verify red**

Run: `pnpm --filter web exec vitest run lib/landingCopy.test.tsx`

Expected: FAIL because `landingCopy.ts` does not exist and old CTAs remain.

- [ ] **Step 3: Create the typed copy landmarks**

Create `landingCopy.ts`:

```ts
export const LANDING_COPY = {
  title: 'VibeCheck — the live press check for AI-built frontends',
  metaDescription: 'A live press check for AI-built frontends. Catch performance and discoverability defects, then hand the marked-up evidence back to your coding agent.',
  hero: {
    eyebrow: ['VibeCheck', 'live press check', 'AI-built frontend'],
    headline: ['Your agent shipped it.', 'VibeCheck pulled the proof.'],
    lede: 'A live press check for the AI-built frontend. VibeCheck reads every pass for jank, leaks, DOM bloat, layout shift, and discoverability defects—then hands the marked-up evidence back to your coding agent before those mistakes harden into production.',
    liveNote: 'The proof in the bottom-right is live—it is reading this page now.',
  },
  sections: {
    problem: {
      title: 'What slips through the first pass',
      sub: 'before the ink dries',
      body: [
        'The first pass can look clean and still be wrong. An AI agent ships a frontend that holds together in the happy path, then leaks memory across routes, bloats the DOM to 10k nodes, fires the same request eight times, janks on scroll, shifts as assets load, and quietly disappears from search and answer engines. The screen looked finished. Nobody pulled a proof.',
        'VibeCheck is the press check your coding agent was missing. It watches each run like a printer reads a proof sheet: measuring the page, marking the defects, and returning exact evidence through MCP so the agent can correct the next pass.',
      ],
    },
    demo: {
      title: 'Pull a bad proof',
      sub: 'make the defects visible',
      body: 'These are not mockups. Each control deliberately throws part of this page out of register: memory, DOM size, layout, requests, or the console. The live proof in the corner marks the fault within seconds. Clear the proof when you are done and the page returns to register.',
    },
    measurements: {
      title: 'Every pass, measured',
      sub: 'live control strip',
      body: 'A press operator does not judge a run by sight alone; the control strip tells the truth. VibeCheck does the same for the browser, continuously reading frame health, main-thread stalls, JS-heap memory, and Core Web Vitals from this page. These are live measurements, not a mockup.',
      closing: 'Those are the control readings. On top of them, VibeCheck identifies thirteen recurring defects by name and marks the exact evidence your agent needs for the correction.',
    },
    bestiary: {
      title: 'The Slop Bestiary',
      sub: 'thirteen recurring misprints',
      body: 'A specimen drawer of the defects AI agents keep putting back into circulation. Each card names the culprit, records how it slips into the run, and shows the exact proof mark VibeCheck emits when it catches one.',
      auditBody: 'Two specimens—seo and aeo—run as pass/fail press checks. Pull a proof of the page you are reading and see what search crawlers and answer engines actually receive, misses included.',
    },
    loop: {
      title: 'From proof mark to fix',
      sub: 'the correction loop',
      body: 'A useful proof does more than say something is wrong. The widget captures the reading, sends it to the local MCP server, and gives your coding agent the marked evidence it needs to propose the correction.',
      transition: 'Here is an illustrative correction loop as your agent sees it: a defect is marked, the evidence travels over MCP, a diff is proposed, and the next pass returns to register. The public demo stays local-only. Put it through the press:',
    },
    install: {
      title: 'Install the press check',
      sub: 'two blocks',
      closing: 'Nine project-scoped MCP tools, an llms.txt, and a Claude skill ship with the press check. The widget marks the defects; your agent gets the evidence.',
    },
  },
  demo: {
    reset: 'Clear the proof',
    calm: 'Proof is clean. Introduce a fault above; the live press check will mark it within seconds.',
  },
  gauges: {
    header: 'Live proof · this page, right now',
    note: 'read from the same collectors the widget ships',
  },
  audit: {
    heading: 'Pull a discoverability proof',
    button: 'Run the SEO / AEO press check',
    scanLink: 'Run a press check on any URL →',
  },
  install: {
    firstHeading: 'Mount the live proof',
    secondHeading: 'Connect the correction loop',
    quickstart: 'Set up the press check in five minutes →',
  },
  footerLead: 'Pull a proof before you call it done.',
} as const
```

- [ ] **Step 4: Replace the landing argument with the approved copy**

Import `LANDING_COPY` into all four consumers. Render its metadata, hero, section headings, body passages, CTA labels, and footer line in the corresponding existing page positions. Preserve `code` styling around `seo`, `aeo`, and `llms.txt`, and keep the existing links and interactive components in their current sequence. Do not modify detector names or technical issue strings.

In `AuditThisPage`, use the press-check label in idle and completed phases while retaining `Auditing this page…` during execution. In `BreakThisPage`, use `LANDING_COPY.demo.reset` and `LANDING_COPY.demo.calm`; leave armed-fault counts literal.

- [ ] **Step 5: Run web tests and lint**

Run: `pnpm --filter web test && pnpm --filter web lint`

Expected: all web tests PASS; TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/landingCopy.ts apps/web/lib/landingCopy.test.tsx apps/web/app/page.tsx apps/web/components/landing/BreakThisPage.tsx apps/web/components/landing/LiveGauges.tsx apps/web/components/landing/AuditThisPage.tsx
git commit -m "feat(site): tell the live press check story"
```

---

### Task 5: Widget Proof-Mark Microcopy

**Files:**
- Modify: `packages/react/src/panels/monitor/MonitorView.tsx`
- Modify: `packages/react/src/panels/monitor/MonitorProofDetails.test.tsx`

**Interfaces:**
- Changes only vibe-mode display copy from `problems` to `proof marks` in the monitor heading.
- Preserves agent mode `issues`, fix CTA, issue titles, counts, navigation, and accessibility semantics.

- [ ] **Step 1: Add the failing microcopy assertion**

In the existing monitor proof-details test, add:

```tsx
expect(container.querySelector('[data-wcgw-proof-marks-heading]')?.textContent).toBe('proof marks')
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/panels/monitor/MonitorProofDetails.test.tsx`

Expected: FAIL because the heading still says `problems` and has no marker attribute.

- [ ] **Step 3: Implement the microcopy**

Change the monitor heading to:

```tsx
<span data-wcgw-proof-marks-heading={mode === 'vibe' ? '' : undefined}>
  {mode === 'vibe' ? 'proof marks' : 'issues'}
</span>
```

- [ ] **Step 4: Run React tests and lint**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all React tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/panels/monitor/MonitorView.tsx packages/react/src/panels/monitor/MonitorProofDetails.test.tsx
git commit -m "feat(widget): name detected issues as proof marks"
```

---

### Task 6: Full Verification and Visual Review

**Files:**
- Modify only if verification reveals a scoped defect.

**Interfaces:**
- Verifies the combined output; introduces no new public API.

- [ ] **Step 1: Run repository verification**

Run: `pnpm test && pnpm lint && pnpm --filter web lint && pnpm build`

Expected: all tests PASS; all TypeScript checks exit 0; protocol, core, MCP, React, demo, and web builds succeed.

- [ ] **Step 2: Start an isolated preview**

Run: `pnpm --filter web exec next dev --webpack -p 3300`

Expected: Next reports `Ready` at `http://localhost:3300`.

- [ ] **Step 3: Inspect desktop and mobile**

Using the Playwright CLI, capture:

- Desktop 1440×1050 with expanded widget.
- Desktop with collapsed widget pill.
- Mobile 390×844 with the mobile wordmark and proof version.
- Bestiary card showing the 4px control strip.

Verify `document.documentElement.scrollWidth === document.documentElement.clientWidth` after excluding the existing diagnostic issue-marker overlay. Confirm no proof furniture overlaps text or interactive controls.

- [ ] **Step 4: Verify reduced-motion behavior**

Confirm the injected widget stylesheet still sets `[data-wcgw-proof-ink] { transform: none !important; }` under `prefers-reduced-motion: reduce` and that all decorative furniture is `aria-hidden`.

- [ ] **Step 5: Review the copy in sequence**

Read the page from hero through footer in the rendered browser. Confirm each plate advances one argument, every metaphor is paired with literal product meaning, and no section introduces an unsupported product claim.

- [ ] **Step 6: Confirm the implementation worktree is clean**

If a scoped defect appeared in Steps 1–5, return to its owning task, add a failing regression test, implement the correction, rerun that task’s checks, and commit it there. Then run:

```bash
git status --short
```

Expected: no tracked modifications. Repository-root user files may remain untracked and must not be staged.
