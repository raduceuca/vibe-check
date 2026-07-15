# Proof-Control System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ambiguous CMYK dash with deliberate top-edge press controls and distribute restrained calibration details across the widget and public landing page.

**Architecture:** Build small proof-mark primitives separately for the isolated widget and the website, then compose them into top registers and component-level annotations. Preserve all existing semantic colors and component geometry; new marks remain decorative, prefixed, theme-aware, and testable through stable data attributes.

**Tech Stack:** React 18/19, TypeScript strict mode, inline widget styles, site CSS tokens, Vitest, Testing Library, Next.js.

## Global Constraints

- Keep the widget exactly `320px` wide and retain the collapsed pill's metric flow.
- Keep current rounded surfaces, typography, shadows, semantic status colors, and light/dark themes.
- Use one-pixel geometry, varied process-density patches, and sub-pixel registration offsets only.
- Do not add distressed texture, thick frames, square shells, fake paper, new fonts, or runtime dependencies.
- Decorative marks use `aria-hidden="true"`, never intercept pointer input, and never carry pass/fail meaning by color alone.
- Reduced-motion mode aligns every process plate and removes registration motion.
- React package UI remains inline-styled except for the existing injected, prefixed stylesheet.

---

### Task 1: Widget Proof Primitives

**Files:**
- Create: `packages/react/src/panels/ui/ProofMarks.tsx`
- Create: `packages/react/src/panels/ui/ProofMarks.test.tsx`
- Delete after migration: `packages/react/src/panels/ui/ProofRail.tsx`
- Delete after migration: `packages/react/src/panels/ui/ProofRail.test.tsx`
- Modify: `packages/react/src/theme.ts`

**Interfaces:**
- Produces: `ProofControlStrip({ faulted?: boolean; compact?: boolean })`
- Produces: `RegistrationTarget({ faulted?: boolean; size?: number })`
- Produces: `CropTicks({ corner?: 'top-left' | 'top-right'; compact?: boolean })`
- Produces: `ProofLabel({ children: ReactNode })`
- Produces: `CalibrationRuler({ orientation?: 'horizontal' | 'vertical' })`
- Produces: `TopProofRegister({ faulted?: boolean })`
- Produces: `PillProofRegister({ faulted?: boolean })`

- [ ] **Step 1: Write the failing primitive tests**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PillProofRegister, ProofControlStrip, TopProofRegister } from './ProofMarks.js'

describe('proof-control marks', () => {
  it('renders a varied density strip instead of four equal dashes', () => {
    const { container } = render(<ProofControlStrip />)
    const patches = container.querySelectorAll('[data-wcgw-proof-patch]')
    expect(patches).toHaveLength(8)
    expect(new Set(Array.from(patches, (node) => node.getAttribute('data-width'))).size).toBeGreaterThan(2)
  })

  it('composes the expanded register as a top-edge proof control', () => {
    render(<TopProofRegister faulted />)
    const register = screen.getByTestId('wcgw-top-proof-register')
    expect(register.getAttribute('aria-hidden')).toBe('true')
    expect(register.getAttribute('data-faulted')).toBe('true')
    expect(register.textContent).toContain('LIVE PROOF')
    expect(register.querySelector('[data-wcgw-registration-target]')).toBeTruthy()
  })

  it('keeps the pill register separate from metric content', () => {
    render(<PillProofRegister />)
    expect(screen.getByTestId('wcgw-pill-proof-register').getAttribute('aria-hidden')).toBe('true')
  })
})
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/panels/ui/ProofMarks.test.tsx`

Expected: FAIL because `ProofMarks.tsx` does not exist.

- [ ] **Step 3: Implement the proof primitives**

Use eight patches with stable widths `[7, 10, 5, 12, 7, 4, 6, 9]`, process/tint colors, and `data-width` attributes. Compose `TopProofRegister` in this order: left crop tick, density strip, `LIVE PROOF` label, flexible hairline, registration target. Compose `PillProofRegister` from a compact crop tick, compact strip, and 5px register dot. Every root carries `aria-hidden="true"` and `pointerEvents: 'none'`.

The top register root must expose:

```tsx
<span
  data-testid="wcgw-top-proof-register"
  data-wcgw-top-proof-register
  data-faulted={faulted ? 'true' : undefined}
  aria-hidden="true"
/>
```

Add prefixed CSS rules for fault offsets and reduced motion:

```css
[data-wcgw-proof-control][data-faulted="true"] [data-wcgw-proof-ink="c"] { transform: translate(-0.75px,0.35px); }
[data-wcgw-proof-control][data-faulted="true"] [data-wcgw-proof-ink="m"] { transform: translate(0.75px,-0.35px); }
[data-wcgw-proof-control][data-faulted="true"] [data-wcgw-proof-ink="y"] { transform: translate(0.25px,0.6px); }
@media (prefers-reduced-motion: reduce) {
  [data-wcgw-proof-ink] { transform: none !important; }
}
```

- [ ] **Step 4: Run the primitive tests**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/panels/ui/ProofMarks.test.tsx`

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/panels/ui/ProofMarks.tsx packages/react/src/panels/ui/ProofMarks.test.tsx packages/react/src/theme.ts
git commit -m "feat(widget): build press-control primitives"
```

### Task 2: Widget Top and Pill Registers

**Files:**
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: `packages/react/src/panels/CollapsedPill.tsx`
- Modify: `packages/react/src/__tests__/VibeCheck.test.tsx`
- Delete: `packages/react/src/panels/ui/ProofRail.tsx`
- Delete: `packages/react/src/panels/ui/ProofRail.test.tsx`

**Interfaces:**
- Consumes: `TopProofRegister` and `PillProofRegister` from Task 1.
- Preserves: expanded shell width `320px` and pill metric markup.

- [ ] **Step 1: Write failing shell-placement tests**

Extend `VibeCheck.test.tsx`:

```tsx
it('places the proof register before the interactive header', () => {
  render(<VibeCheck enabled />)
  const overlay = screen.getByTestId('vibe-check-overlay')
  const register = screen.getByTestId('wcgw-top-proof-register')
  const header = screen.getByTestId('vibe-check-header')
  expect(overlay.style.width).toBe('320px')
  expect(register.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it('uses an edge register in the collapsed pill without covering metrics', () => {
  render(<VibeCheck enabled startCollapsed />)
  expect(screen.getByTestId('wcgw-pill-proof-register')).toBeTruthy()
  expect(screen.queryByTestId('wcgw-top-proof-register')).toBeNull()
})
```

- [ ] **Step 2: Run the shell tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/__tests__/VibeCheck.test.tsx`

Expected: FAIL because the old rail remains inside the header and the new register test IDs are absent.

- [ ] **Step 3: Integrate the expanded top register**

Render `<TopProofRegister faulted={activeCount > 0} />` as the first child inside the overlay and before the header. Remove the absolute top-right `ProofRail`. Use a 12px register height with padding `7px 14px 0`; keep header horizontal padding and title/status geometry unchanged.

- [ ] **Step 4: Integrate the collapsed edge register**

Remove the absolute right-side `ProofRail`. Render `<PillProofRegister faulted={activeCount > 0} />` at `top: -2px; left: 20px`, outside the metric row. Do not change pill padding, gap, issue badge, or aria label.

- [ ] **Step 5: Run widget tests and lint**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all widget tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/VibeCheck.tsx packages/react/src/panels/CollapsedPill.tsx packages/react/src/__tests__/VibeCheck.test.tsx packages/react/src/panels/ui/ProofRail.tsx packages/react/src/panels/ui/ProofRail.test.tsx
git commit -m "fix(widget): move proof marks to the top edge"
```

### Task 3: Widget Interior Calibration Details

**Files:**
- Modify: `packages/react/src/panels/monitor/MonitorView.tsx`
- Modify: `packages/react/src/panels/nav/BottomNav.tsx`
- Create: `packages/react/src/panels/monitor/MonitorProofDetails.test.tsx`
- Modify: `packages/react/src/theme.ts`

**Interfaces:**
- Consumes: `CalibrationRuler`, `ProofLabel`, and `RegistrationTarget` from Task 1.
- Produces stable test attributes: `data-wcgw-read-sample`, `data-wcgw-calibration-ruler`, `data-wcgw-audit-plate`, `data-wcgw-issue-register`, `data-wcgw-nav-proof`.

- [ ] **Step 1: Write failing monitor-detail tests**

Render `MonitorView` with an empty snapshot and history fixture, then assert:

```tsx
expect(container.querySelector('[data-wcgw-read-sample]')?.textContent).toBe('READ / SAMPLE')
expect(container.querySelectorAll('[data-wcgw-calibration-ruler]')).toHaveLength(1)
expect(container.querySelectorAll('[data-wcgw-audit-plate]')).toHaveLength(2)
```

Render `BottomNav activeView="monitor"` and assert:

```tsx
expect(container.querySelector('[data-wcgw-nav-proof]')?.textContent).toBe('PL 01/06')
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/panels/monitor/MonitorProofDetails.test.tsx`

Expected: FAIL because the proof details are absent.

- [ ] **Step 3: Add monitor annotations**

Add `READ / SAMPLE` plus a 10px registration target to the upper-right of the FPS hero. Add one vertical `CalibrationRuler` at the chart's right edge. Give audit chips plate labels `CHK 01` and `CHK 02`. Add an 8px registration target at the far edge of each `QuickIssue`, after the truncated title.

- [ ] **Step 4: Add the active navigation plate label**

Wrap `Tabs` in a positioned container and render `PL ${String(activeIndex + 1).padStart(2, '0')}/06` at the top-right with 8px mono type. Keep each tab's 44px hit area and the existing active underline.

- [ ] **Step 5: Run widget tests and lint**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all widget tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```bash
git add packages/react/src/panels/monitor/MonitorView.tsx packages/react/src/panels/monitor/MonitorProofDetails.test.tsx packages/react/src/panels/nav/BottomNav.tsx packages/react/src/theme.ts
git commit -m "feat(widget): add calibration micro-details"
```

### Task 4: Website Proof Header and Shared Marks

**Files:**
- Modify: `apps/web/components/brand/ProofMarks.tsx`
- Modify: `apps/web/components/brand/ProofMarks.test.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Produces: `ProofControlStrip`, `CropTicks`, `ProofLabel`, `CalibrationRuler`, and `RegistrationTarget` for the site.
- Preserves: `RegistrationConstellation` and existing process tokens.

- [ ] **Step 1: Replace the old rail test with failing proof-system tests**

```tsx
it('renders a varied process density strip', () => {
  const markup = renderToStaticMarkup(<ProofControlStrip className="strip" />)
  expect(markup.match(/data-vc-proof-patch/g)).toHaveLength(8)
  expect(markup).toContain('data-width="12"')
  expect(markup).toContain('aria-hidden="true"')
})

it('renders crop, label, ruler, and registration primitives as decoration', () => {
  const markup = renderToStaticMarkup(<><CropTicks /><ProofLabel>PROOF 01</ProofLabel><CalibrationRuler /><RegistrationTarget /></>)
  expect(markup).toContain('PROOF 01')
  expect(markup).toContain('data-vc-crop-ticks')
  expect(markup).toContain('data-vc-calibration-ruler')
  expect(markup).toContain('data-vc-registration-target')
})
```

- [ ] **Step 2: Run the web tests and verify failure**

Run: `pnpm --filter web exec vitest run components/brand/ProofMarks.test.tsx`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement the website proof primitives**

Use the same eight patch widths and process/tint order as the widget. Use site-prefixed `data-vc-*` attributes and existing `--vc-proof-*` tokens. Keep the large `RegistrationConstellation` unchanged.

- [ ] **Step 4: Build the hero proof header**

Add a `vc-proof-header` as the first hero child, above `vc-eyebrow`. Compose left crop ticks, density strip, `PROOF 01`, a flexible hairline, and a compact registration target. Remove the old `ProofRail` from the eyebrow. Retain the large constellation in negative space.

- [ ] **Step 5: Add responsive and theme styling**

At desktop, the header spans the content column and remains lower than 18px. At mobile, it wraps neither its strip nor label and stays within `calc(100vw - 40px)`. Use exact transition properties and preserve the current hero spacing.

- [ ] **Step 6: Run web tests and lint**

Run: `pnpm --filter web test && pnpm --filter web lint`

Expected: all web tests pass and TypeScript exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/brand/ProofMarks.tsx apps/web/components/brand/ProofMarks.test.tsx apps/web/app/page.tsx apps/web/app/global.css
git commit -m "feat(site): build a true hero proof header"
```

### Task 5: Website Component-Level Proof Details

**Files:**
- Modify: `apps/web/components/landing/SectionHead.tsx`
- Modify: `apps/web/components/landing/LiveGauges.tsx`
- Modify: `apps/web/components/landing/InstallCommand.tsx`
- Modify: `apps/web/components/landing/DetectorsGrid.tsx`
- Modify: `apps/web/components/diagrams/PipelineDiagram.tsx`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/global.css`
- Create: `apps/web/components/landing/proofSurfaces.test.tsx`

**Interfaces:**
- `SectionHead` gains `index?: string` and renders `PLATE {index}` when provided.
- Each live gauge receives a stable `data-proof-index` from `01` through `06`.
- Install and code surfaces expose `data-vc-proof-surface`.

- [ ] **Step 1: Write failing component-surface tests**

```tsx
it('numbers landing section heads as proof plates', () => {
  const markup = renderToStaticMarkup(<SectionHead index="03" title="Always measuring" sub="the live layer" />)
  expect(markup).toContain('PLATE 03')
  expect(markup).toContain('data-vc-section-proof')
})

it('adds proof geometry to live gauges and install surfaces', () => {
  const gauges = renderToStaticMarkup(<LiveGauges />)
  const install = renderToStaticMarkup(<InstallCommand command="npm i @wcgw/vibe-check" />)
  expect(gauges.match(/data-proof-index=/g)).toHaveLength(6)
  expect(gauges).toContain('data-vc-calibration-ruler')
  expect(install).toContain('data-vc-proof-surface')
  expect(install).toContain('K 100')
})
```

- [ ] **Step 2: Run the focused site tests and verify failure**

Run: `pnpm --filter web exec vitest run components/landing/proofSurfaces.test.tsx`

Expected: FAIL because the proof surface contracts are absent.

- [ ] **Step 3: Number and decorate section headings**

Pass indices `01` through `06` from `page.tsx`. Render a short edge tick plus `PLATE NN` beside the existing right-side subcopy. On mobile, keep the title on its own line and group proof label with the subcopy.

- [ ] **Step 4: Decorate live metrics and install/code surfaces**

Add one horizontal calibration ruler to the gauges header. Give each gauge a tiny `NN` plate index in its top-right corner. Add a top-left crop fragment and `K 100` label to `InstallCommand`. Wrap each landing `pre.vc-pre` in a positioned proof surface with a crop fragment and `PLATE K` label while preserving the preformatted text.

- [ ] **Step 5: Refine bestiary and pipeline marks**

Replace the bestiary footer's equal gradient signature with the varied eight-patch density pattern. Add one compact registration target at each pipeline row transfer point in the wide diagram and at the first/last stages in the narrow diagram. Keep diagram nodes, arrows, and semantic red/green accents unchanged.

- [ ] **Step 6: Add footer crop termination**

Add a crop tick at each end of the existing footer hairline using pseudo-elements. Do not turn the footer rule into a color band.

- [ ] **Step 7: Run web tests, lint, and build**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web build`

Expected: all web tests pass, TypeScript exits 0, and Next.js completes the production build.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/landing/SectionHead.tsx apps/web/components/landing/LiveGauges.tsx apps/web/components/landing/InstallCommand.tsx apps/web/components/landing/DetectorsGrid.tsx apps/web/components/diagrams/PipelineDiagram.tsx apps/web/components/landing/proofSurfaces.test.tsx apps/web/app/page.tsx apps/web/app/global.css
git commit -m "feat(site): distribute proof-control details"
```

### Task 6: Full Verification and Integration

**Files:**
- Modify only if verification exposes a defect: files changed in Tasks 1–5.

**Interfaces:**
- Consumes the complete widget and website proof-control system.
- Produces a verified branch ready for local integration.

- [ ] **Step 1: Run repository verification**

Run:

```bash
pnpm test
pnpm lint
pnpm build
```

Expected: all repository tests pass, all TypeScript checks pass, and every workspace package builds.

- [ ] **Step 2: Verify the live site in a real browser**

At `1440×900`, inspect light and dark modes. Confirm the hero proof header is the first visual item under the site chrome, section annotations remain subordinate, and the widget's expanded proof register reads as a top control area.

- [ ] **Step 3: Verify mobile and collapsed widget behavior**

At `390×844`, confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`, the hero proof header stays within the viewport, the pill proof register does not cover FPS/memory/issue metrics, and the expanded widget remains `320px` wide.

- [ ] **Step 4: Verify reduced motion and accessibility**

Emulate `prefers-reduced-motion: reduce`; confirm all `[data-wcgw-proof-ink]` and `[data-vc-process-plate]` transforms compute to `none`. Confirm proof marks are absent from the accessibility snapshot and semantic severity text remains visible.

- [ ] **Step 5: Review and commit verification fixes**

Run: `git diff --check && git status --short`

If verification changed implementation files, stage only those files and commit:

```bash
git commit -m "fix: polish proof-control behavior"
```
