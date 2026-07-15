# Print-Proof Brand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a restrained prepress signature to the public website and React widget while preserving their current modern layout and component language.

**Architecture:** The website gets theme-aware process tokens plus small reusable SVG primitives, used only in the landing hero and process-aware bestiary drawings. The widget gets separately prefixed process tokens and a tiny proof rail whose segments misregister only when active issues exist; its existing shell and controls remain unchanged. Static component tests verify decorative/accessibility contracts, widget tests verify registered/faulted behavior, and browser screenshots verify visual restraint.

**Tech Stack:** TypeScript 5.9, React 19 website / React 18+ widget peer API, Next.js 16, inline SVG, CSS custom properties, Vitest 4, Testing Library, Playwright CLI.

## Global Constraints

- Keep the current information architecture, layout, typography, spacing, radii, soft elevation, card construction, and widget dimensions.
- Keep automatic light and dark modes for both the public website and embeddable widget.
- Black/K remains dominant; CMYK is evidence and process, not decoration.
- Do not add thick outlined rectangles, hard cartoon-like panels, distressed textures, new fonts, or runtime dependencies.
- Process colors do not replace semantic health and severity colors.
- Decorative marks are `aria-hidden`, pointer-inert, and layout-neutral.
- Website runtime code keeps named arrow exports; widget UI keeps inline styles and `--wcgw-`-prefixed injected CSS.
- Process-layer separation is 0.5–1px and disabled by reduced-motion preferences.

---

### Task 1: Website proof tokens and hero signature

**Files:**
- Create: `apps/web/components/brand/ProofMarks.tsx`
- Create: `apps/web/components/brand/ProofMarks.test.tsx`
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/app/global.css`
- Modify: `apps/web/package.json`
- Modify: `vitest.workspace.ts`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: `ProofRail({ className?: string })` and `RegistrationConstellation({ className?: string })`, both decorative server-safe components.
- Produces: `--vc-proof-c`, `--vc-proof-m`, `--vc-proof-y`, and `--vc-proof-k` under `.vc-landing` and `.vc-docs` for later bestiary work.
- Consumes: existing `.vc-eyebrow`, `.vc-wrap`, and light/dark token scopes.

- [ ] **Step 1: Add a failing static-render test for the proof primitives**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ProofRail, RegistrationConstellation } from './ProofMarks'

describe('proof marks', () => {
  it('renders decorative, theme-driven process geometry', () => {
    const rail = renderToStaticMarkup(<ProofRail className="rail" />)
    const target = renderToStaticMarkup(<RegistrationConstellation className="target" />)
    expect(rail).toContain('aria-hidden="true"')
    expect(rail).toContain('var(--vc-proof-c)')
    expect(rail).toContain('var(--vc-proof-m)')
    expect(target).toContain('aria-hidden="true"')
    expect(target).toContain('vc-registration-plate')
  })
})
```

- [ ] **Step 2: Add the website Vitest workspace and run the test to verify it fails**

Add `apps/web/vitest.config.ts` with the `@` alias pointing at `apps/web`, Node environment, and `components/**/*.test.tsx` include. Add `apps/web/vitest.config.ts` to `vitest.workspace.ts`, add `"test": "vitest run"` and `vitest` to `apps/web/package.json`, then refresh the lockfile.

Run: `pnpm --filter web test -- components/brand/ProofMarks.test.tsx`

Expected: FAIL because `ProofMarks.tsx` does not exist.

- [ ] **Step 3: Implement the decorative primitives**

```tsx
interface ProofMarkProps {
  readonly className?: string
}

export const ProofRail = ({ className }: ProofMarkProps) => (
  <span className={className} aria-hidden="true" style={{ display: 'inline-flex' }}>
    {(['c', 'm', 'y', 'k'] as const).map((ink) => (
      <i key={ink} style={{ background: `var(--vc-proof-${ink})` }} />
    ))}
  </span>
)

export const RegistrationConstellation = ({ className }: ProofMarkProps) => (
  <svg className={className} viewBox="0 0 96 96" aria-hidden="true" focusable="false">
    <g className="vc-registration-plate vc-registration-plate-c"><circle cx="48" cy="48" r="31" /><path d="M7 48h82M48 7v82" /></g>
    <g className="vc-registration-plate vc-registration-plate-m"><circle cx="48" cy="48" r="31" /><path d="M7 48h82M48 7v82" /></g>
    <g className="vc-registration-plate vc-registration-plate-k"><circle cx="48" cy="48" r="31" /><circle cx="48" cy="48" r="16" /><path d="M7 48h82M48 7v82" /><circle cx="48" cy="48" r="2.5" /></g>
  </svg>
)
```

- [ ] **Step 4: Add theme tokens and place the marks without changing layout**

Add process tokens to each existing light/dark website token block. Add `className="vc-hero"` to the landing header, insert `ProofRail` at the start of `.vc-eyebrow`, and render `RegistrationConstellation` as an absolutely positioned child. CSS must keep the rail at `56px × 3px`, the constellation pointer-inert, and hide the large constellation below `1100px` while leaving the rail visible.

- [ ] **Step 5: Run static tests, type-check, and commit**

Run: `pnpm --filter web test && pnpm --filter web lint`

Expected: all tests pass and TypeScript exits 0.

```bash
git add apps/web/components/brand apps/web/vitest.config.ts apps/web/app/page.tsx apps/web/app/global.css apps/web/package.json vitest.workspace.ts pnpm-lock.yaml
git commit -m "feat(site): add restrained print-proof signature"
```

### Task 2: Process-aware bestiary illustrations

**Files:**
- Modify: `apps/web/components/issueArt/artKit.tsx`
- Modify: `apps/web/components/issueArt/instrumentKit.tsx`
- Modify: all 13 `apps/web/components/issueArt/*Art.tsx` detector files
- Create: `apps/web/components/issueArt/issueArt.test.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Produces: `ProcessPlate({ ink, children })` with `ink: 'cyan' | 'magenta' | 'yellow'`, rendering `<g data-vc-process-plate="...">` and theme-token color.
- Consumes: `--vc-proof-c/m/y/k` from Task 1 and existing `ArtSvg`, `Ring`, `Arc`, `Ray`, `Crosshair`, and `Node` primitives.

- [ ] **Step 1: Add a failing render contract for every detector glyph**

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ISSUE_ART } from './index'

describe('process-aware issue art', () => {
  it.each(Object.entries(ISSUE_ART))('%s keeps K structure and at least one process plate', (_, Art) => {
    const markup = renderToStaticMarkup(<Art />)
    expect(markup).toContain('currentColor')
    expect(markup).toContain('data-vc-process-plate=')
    expect(markup).toMatch(/--vc-proof-(c|m|y)/)
  })
})
```

- [ ] **Step 2: Run the contract to verify it fails**

Run: `pnpm --filter web test -- components/issueArt/issueArt.test.tsx`

Expected: FAIL because the current glyphs are single-ink and expose no process plates.

- [ ] **Step 3: Add the shared process wrapper**

```tsx
import type { ReactNode } from 'react'

type ProcessInk = 'cyan' | 'magenta' | 'yellow'

export const ProcessPlate = ({ ink, children }: { readonly ink: ProcessInk; readonly children: ReactNode }) => (
  <g
    data-vc-process-plate={ink}
    style={{ color: `var(--vc-proof-${ink === 'cyan' ? 'c' : ink === 'magenta' ? 'm' : 'y'})` }}
  >
    {children}
  </g>
)
```

Retain `currentColor` as the structural/K default in `ArtSvg` and update comments that currently require monochrome-only output.

- [ ] **Step 4: Apply exact process semantics to all thirteen drawings**

Use these assignments; unlisted structural elements stay K/currentColor:

| Detector | Cyan plate | Magenta plate | Yellow plate |
| --- | --- | --- | --- |
| `aeo` | outer broadcast wave | middle broadcast wave | inner broadcast wave |
| `console-spam` | dashed rays at indices 0, 3, 6 | dashed rays at indices 1, 4, 7 | dashed rays at indices 2, 5, 8 |
| `dom-bloat` | outer swelling boundary | second offset boundary at `r=18.8` | none; branches remain K |
| `duplicate-requests` | furthest echo | middle echo | nearest echo |
| `heavy-library` | small dependency at `-140°` | small dependency at `140°` | small dependency at `180°` |
| `large-images` | outer mass ring | inner mass ring | hanging plumb line and leaf |
| `layout-thrashing` | first ghost crosshair | second ghost crosshair shifted `-1px/+1px` from the existing ghost | ghost square |
| `long-task-attribution` | range ring | halted sweep arc | stall tick |
| `memory-leak` | outer open arc | middle open arc | inner open arc |
| `resource-bloat` | outer horizon | weight boundary | three alternating resource tips |
| `seo` | outer radar ring | middle radar ring | inner radar ring |
| `unoptimized-images` | served-size outer square | reduce arc | inward chevron |
| `web-essentials` | lower gauge arc | none | small baseline check |

Wrap only the named geometry in `ProcessPlate`; do not duplicate entire glyphs or color focal nodes.

- [ ] **Step 5: Add restrained plate behavior to existing bestiary CSS**

Add CSS that sets `transform-box: fill-box`, `transform-origin: center`, and an exact-property transition on process groups. On `.vc-spec:hover`, `:focus-visible`, and `:focus-within`, translate cyan `-0.75px, 0.35px`, magenta `0.75px, -0.35px`, and yellow `0.25px, 0.6px`. Under reduced motion, remove transition and transform. Add a `22px × 2px` four-ink gradient via `.vc-spec-foot::before`; do not change card borders, radius, or layout height.

- [ ] **Step 6: Run tests, type-check, and commit**

Run: `pnpm --filter web test && pnpm --filter web lint`

Expected: all glyph cases pass and TypeScript exits 0.

```bash
git add apps/web/components/issueArt apps/web/app/global.css
git commit -m "feat(site): redraw bestiary in process inks"
```

### Task 3: Widget proof rail and fault registration state

**Files:**
- Create: `packages/react/src/panels/ui/ProofRail.tsx`
- Create: `packages/react/src/panels/ui/ProofRail.test.tsx`
- Modify: `packages/react/src/theme.ts`
- Modify: `packages/react/src/tokens.ts`
- Modify: `packages/react/src/VibeCheck.tsx`
- Modify: `packages/react/src/panels/CollapsedPill.tsx`
- Modify: `packages/react/src/__tests__/VibeCheck.test.tsx`

**Interfaces:**
- Produces: `ProofRail({ faulted?: boolean; compact?: boolean })` with `data-wcgw-proof-rail`, four theme-token segments, and `data-faulted` only when issues are active.
- Produces: widget tokens `--wcgw-proof-c/m/y/k` in both theme blocks and `T.proofC/M/Y/K` accessors.
- Consumes: `activeCount` already computed in `VibeCheck` and `CollapsedPill`.

- [ ] **Step 1: Write failing component and integration tests**

```tsx
it('registers the proof rail while healthy and separates it for active issues', () => {
  const { rerender } = render(<ProofRail faulted={false} />)
  expect(screen.getByTestId('wcgw-proof-rail')).not.toHaveAttribute('data-faulted')
  rerender(<ProofRail faulted />)
  expect(screen.getByTestId('wcgw-proof-rail')).toHaveAttribute('data-faulted', 'true')
})
```

Extend `VibeCheck.test.tsx` with one healthy snapshot and one warning issue snapshot, asserting the header rail toggles `data-faulted` while the overlay width remains `320px`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @wcgw/vibe-check test -- src/panels/ui/ProofRail.test.tsx src/__tests__/VibeCheck.test.tsx`

Expected: FAIL because `ProofRail` and proof tokens do not exist.

- [ ] **Step 3: Add scoped widget process tokens and the component**

Implement four theme-tuned token values in `ANIMATIONS_CSS`, expose them through `T`, and render four `2px` segments in a `34px × 2px` pointer-inert rail. The component remains `aria-hidden` and applies no animation inline; the injected stylesheet controls segment transforms under `[data-faulted]` and disables them under reduced motion.

- [ ] **Step 4: Integrate without changing widget geometry**

Make the expanded header `position: relative` and absolutely place the rail at `top: 13px; right: 16px`. Pass `faulted={activeCount > 0}`. Add a `24px` compact rail near the trailing edge of the collapsed pill without changing its padding or minimum height. Do not alter the status dot, label, metrics, or bottom navigation.

- [ ] **Step 5: Run tests, lint, and commit**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all widget tests pass and TypeScript exits 0.

```bash
git add packages/react/src/panels/ui/ProofRail.tsx packages/react/src/panels/ui/ProofRail.test.tsx packages/react/src/theme.ts packages/react/src/tokens.ts packages/react/src/VibeCheck.tsx packages/react/src/panels/CollapsedPill.tsx packages/react/src/__tests__/VibeCheck.test.tsx
git commit -m "feat(react): add registered proof signature"
```

### Task 4: Fault-aware SVG fallback trace

**Files:**
- Modify: `packages/react/src/panels/monitor/FpsTrace.tsx`
- Create: `packages/react/src/panels/monitor/FpsTrace.test.tsx`
- Modify: `packages/react/src/panels/monitor/MonitorView.tsx`
- Modify: `packages/react/src/theme.ts`

**Interfaces:**
- Changes: `FpsTrace` accepts `faulted?: boolean` and renders cyan/magenta echo polylines only when true.
- Consumes: `activeCount > 0` from `MonitorView` and `--wcgw-proof-c/m` from Task 3.

- [ ] **Step 1: Write the failing trace test**

```tsx
it('adds process echoes only for a faulted trace', async () => {
  const { container, rerender } = render(<FpsTrace fps={42} tick={1} color="#f00" faulted={false} />)
  expect(container.querySelectorAll('[data-wcgw-proof-echo]')).toHaveLength(0)
  rerender(<FpsTrace fps={38} tick={2} color="#f00" faulted />)
  expect(container.querySelectorAll('[data-wcgw-proof-echo]')).toHaveLength(2)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @wcgw/vibe-check test -- src/panels/monitor/FpsTrace.test.tsx`

Expected: FAIL because `faulted` is not accepted and no echo paths render.

- [ ] **Step 3: Render sub-pixel process echoes**

Before the existing primary polyline, conditionally render cyan and magenta polylines using the same points, `strokeWidth={0.75}`, `strokeOpacity={0.28}`, and transforms `translate(-0.75 0.35)` / `translate(0.75 -0.35)`. Mark both with `data-wcgw-proof-echo`. Keep the primary trace unchanged.

- [ ] **Step 4: Pass fault state and honor reduced motion**

Pass `faulted={activeCount > 0}` from the SVG fallback call in `MonitorView`. Add a reduced-motion rule that hides `[data-wcgw-proof-echo]`. Do not modify the lazily loaded Liveline canvas path.

- [ ] **Step 5: Run widget tests and commit**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all tests pass and TypeScript exits 0.

```bash
git add packages/react/src/panels/monitor/FpsTrace.tsx packages/react/src/panels/monitor/FpsTrace.test.tsx packages/react/src/panels/monitor/MonitorView.tsx packages/react/src/theme.ts
git commit -m "feat(react): separate trace plates on faults"
```

### Task 5: Full verification and visual restraint pass

**Files:**
- Modify only if verification exposes a defect: files changed in Tasks 1–4

**Interfaces:**
- Consumes: completed site and widget changes.
- Produces: verified desktop/mobile, light/dark, healthy/faulted behavior with no layout regression.

- [ ] **Step 1: Run repository checks**

Run:

```bash
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web build
pnpm --filter @wcgw/vibe-check test
pnpm --filter @wcgw/vibe-check lint
pnpm test
```

Expected: every command exits 0.

- [ ] **Step 2: Inspect desktop light and dark modes in a real browser**

Run the web app, capture the landing at `1440×900`, and verify the hero constellation sits in negative space, the proof rail does not change eyebrow wrapping, bestiary cards retain their exact footprint, and the widget remains `320px` wide.

- [ ] **Step 3: Inspect mobile and reduced-motion behavior**

At `390×844`, verify the large hero constellation is hidden, the proof rail remains visible, no horizontal overflow appears, the widget pill/panel remains within the viewport, and process-layer transforms are absent under `prefers-reduced-motion: reduce`.

- [ ] **Step 4: Inspect interactions and accessibility**

Keyboard-focus a bestiary card, expand/collapse the widget, and trigger one existing demo fault. Verify process separation does not move text, marks do not intercept clicks, semantic severity remains readable without CMYK, and decorative SVGs are absent from the accessibility tree.

- [ ] **Step 5: Review the final diff and commit verification fixes if needed**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and only intended files changed.

If verification required fixes:

```bash
git add apps/web packages/react
git commit -m "fix: polish print-proof brand behavior"
```
