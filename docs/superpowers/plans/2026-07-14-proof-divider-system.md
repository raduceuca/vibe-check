# Proof Divider System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn existing website, documentation, and widget hairlines into a coherent printing-proof separator system with major proof rails, compact CMYK rule marks, and neutral cut ticks.

**Architecture:** Extend the existing proof-mark modules rather than creating a second visual vocabulary. The website gains reusable `ProofRail` and `StructuralRuleMark` primitives consumed by `SectionHead` and both sidebar shells; the inline-style React package gains one `ProofDivider` primitive consumed by the monitor’s existing major and minor separator locations.

**Tech Stack:** React 18/19, Next.js 16, TypeScript strict mode, CSS for the public website, inline styles for `@wcgw/vibe-check`, Vitest, Testing Library, Playwright CLI.

## Global Constraints

- Keep fine neutral rules, soft surfaces, generous spacing, and restrained CMYK accents.
- Do not add thick outlined containers, vintage-paper treatment, or cartoon press imagery.
- CMYK appears only at major boundaries and section changes; minor rules remain neutral.
- Website section rails use 5px CMYK bars, 10px crop marks, and 16px registration targets.
- Sidebar and widget proof nibs use 4px CMYK bars; minor cut ticks use no color.
- Decorative marks are `aria-hidden`, non-interactive, and cannot alter reading order.
- Preserve a minimum 40×40px mobile navigation hit area and avoid horizontal overflow at 390px.
- The React package continues to use inline styles only.
- Do not change detector behavior, metric collection, MCP data flow, or widget information architecture.

---

### Task 1: Reusable Website Proof Rails and Rule Marks

**Files:**
- Modify: `apps/web/components/brand/ProofMarks.tsx`
- Modify: `apps/web/components/brand/ProofMarks.test.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Produces: `ProofRail({ label, className?, weight? })`, where `weight` is `'hero' | 'section' | 'compact'`.
- Produces: `StructuralRuleMark({ className?, orientation?, color? })`, where `orientation` is `'horizontal' | 'vertical'` and `color` controls the compact CMYK nib.
- Extends: `ProofControlStrip({ className?, weight? })`, preserving `'hero'` as its default weight.
- Preserves: `CropTicks`, `ProofLabel`, and `RegistrationTarget` public behavior.

- [ ] **Step 1: Write failing primitive tests**

Add imports and tests to `ProofMarks.test.tsx`:

```tsx
import {
  ProofRail,
  StructuralRuleMark,
} from './ProofMarks'

it('composes a numbered section proof rail from the shared marks', () => {
  const markup = renderToStaticMarkup(
    <ProofRail label="PROOF 03" weight="section" />,
  )

  expect(markup).toContain('data-vc-proof-rail="section"')
  expect(markup).toContain('PROOF 03')
  expect(markup).toContain('data-vc-proof-control-strip')
  expect(markup).toContain('data-vc-crop-ticks="top-left"')
  expect(markup).toContain('data-vc-registration-target')
})

it('renders colored structural marks and neutral cut terminals', () => {
  const markup = renderToStaticMarkup(
    <>
      <StructuralRuleMark orientation="horizontal" color />
      <StructuralRuleMark orientation="vertical" />
    </>,
  )

  expect(markup).toContain('data-vc-structural-rule="horizontal"')
  expect(markup).toContain('data-vc-rule-color="true"')
  expect(markup).toContain('data-vc-structural-rule="vertical"')
})
```

- [ ] **Step 2: Run the proof-mark test and verify red**

Run: `pnpm --filter web exec vitest run components/brand/ProofMarks.test.tsx`

Expected: FAIL because `ProofRail` and `StructuralRuleMark` are not exported.

- [ ] **Step 3: Implement the reusable primitives**

Add the following interfaces and exports to `ProofMarks.tsx`, composing the existing primitives:

```tsx
interface ProofRailProps extends ProofMarkProps {
  readonly label: string
  readonly weight?: 'hero' | 'section' | 'compact'
}

interface ProofControlStripProps extends ProofMarkProps {
  readonly weight?: 'hero' | 'section' | 'compact'
}

interface StructuralRuleMarkProps extends ProofMarkProps {
  readonly orientation?: 'horizontal' | 'vertical'
  readonly color?: boolean
}

export const ProofRail = ({
  className,
  label,
  weight = 'section',
}: ProofRailProps) => (
  <span className={className} data-vc-proof-rail={weight} aria-hidden="true">
    <CropTicks />
    <ProofControlStrip weight={weight} />
    <ProofLabel>{label}</ProofLabel>
    <span data-vc-proof-rule="" />
    <RegistrationTarget />
  </span>
)

export const StructuralRuleMark = ({
  className,
  orientation = 'horizontal',
  color = false,
}: StructuralRuleMarkProps) => (
  <span
    className={className}
    data-vc-structural-rule={orientation}
    data-vc-rule-color={color ? 'true' : undefined}
    aria-hidden="true"
  >
    <i />
    <i />
    {color ? <ProofControlStrip weight="compact" /> : null}
  </span>
)
```

Update `ProofControlStrip` so its `data-vc-proof-weight` value comes from the new prop. Add CSS keyed by the semantic weights and structural-rule attributes:

```tsx
export const ProofControlStrip = ({
  className,
  weight = 'hero',
}: ProofControlStripProps) => (
  <span
    className={className}
    aria-hidden="true"
    data-vc-proof-control-strip=""
    data-vc-proof-weight={weight}
    style={{ display: 'inline-flex' }}
  >
    {CONTROL_PATCHES.map(({ ink, width }, index) => (
      <i
        key={`${ink}-${index}`}
        data-vc-proof-patch=""
        data-width={width}
        style={{ background: `var(--vc-proof-${ink})`, width }}
      />
    ))}
  </span>
)
```

```css
[data-vc-proof-rail] {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  color: var(--vc-ink-4);
}
[data-vc-proof-weight='section'] { height: 6px; }
[data-vc-proof-weight='section'] i { height: 5px; }
[data-vc-proof-weight='compact'] { height: 5px; }
[data-vc-proof-weight='compact'] i { height: 4px; }
[data-vc-proof-rail='section'] [data-vc-crop-ticks] {
  width: 10px;
  height: 10px;
}
[data-vc-proof-rail='section'] [data-vc-registration-target] {
  width: 16px;
  height: 16px;
}
[data-vc-proof-rule] {
  height: 1px;
  flex: 1 1 auto;
  min-width: 20px;
  background: var(--vc-line);
}
[data-vc-structural-rule='horizontal'] {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
[data-vc-structural-rule='horizontal'] > i:first-child {
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--vc-line-strong);
  border-left: 1px solid var(--vc-line-strong);
}
[data-vc-structural-rule='horizontal'] > i:nth-child(2) {
  height: 1px;
  flex: 1;
  background: var(--vc-line-2);
}
[data-vc-structural-rule='vertical'] {
  display: block;
  width: 8px;
  height: 8px;
  border-top: 1px solid var(--vc-line-strong);
  border-right: 1px solid var(--vc-line-strong);
}
```

- [ ] **Step 4: Run focused tests and lint**

Run: `pnpm --filter web exec vitest run components/brand/ProofMarks.test.tsx && pnpm --filter web lint`

Expected: all proof-mark tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/brand/ProofMarks.tsx apps/web/components/brand/ProofMarks.test.tsx apps/web/app/global.css
git commit -m "feat(site): add reusable proof separators"
```

---

### Task 2: Numbered Landing Section Proof Rails

**Files:**
- Modify: `apps/web/components/landing/SectionHead.tsx`
- Modify: `apps/web/components/landing/proofSurfaces.test.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Consumes: `ProofRail({ label, weight: 'section' })` from Task 1.
- Preserves: `SectionHead({ title, sub?, index? })` call sites and title semantics.
- Produces: one `data-vc-section-proof` rail per indexed section and a clean title row without duplicate `PLATE` text.

- [ ] **Step 1: Change the landing test first**

Replace the existing section-numbering assertion in `proofSurfaces.test.tsx`:

```tsx
it('separates every numbered section with a compact proof rail', () => {
  const markup = renderToStaticMarkup(
    <SectionHead title="Every pass, measured" sub="live control strip" index="03" />,
  )

  expect(markup).toContain('data-vc-section-proof="03"')
  expect(markup).toContain('data-vc-proof-rail="section"')
  expect(markup).toContain('PROOF 03')
  expect(markup).not.toContain('PLATE 03')
  expect(markup).toContain('<h2>Every pass, measured</h2>')
})
```

- [ ] **Step 2: Run the landing surface test and verify red**

Run: `pnpm --filter web exec vitest run components/landing/proofSurfaces.test.tsx`

Expected: FAIL because `SectionHead` still renders `PLATE 03` and no section proof rail.

- [ ] **Step 3: Compose the rail and title row**

Update `SectionHead.tsx`:

```tsx
import { ProofRail } from '@/components/brand/ProofMarks'

export const SectionHead = ({ title, sub, index }: SectionHeadProps) => (
  <div className="vc-sechead">
    {index ? (
      <ProofRail
        className="vc-sechead-proof"
        label={`PROOF ${index}`}
        weight="section"
      />
    ) : null}
    <div className="vc-sechead-row" data-vc-section-proof={index}>
      <h2>{title}</h2>
      {sub ? <span className="vc-sub">{sub}</span> : null}
    </div>
  </div>
)
```

Update `.vc-sechead` to a block wrapper, move its flex/title styles to `.vc-sechead-row`, set the proof rail’s bottom margin to `14px`, and retain the existing bottom hairline, title size, subtitle alignment, mobile wrapping, and section spacing.

```css
.vc-sechead {
  border-bottom: 1px solid var(--vc-line);
  padding-bottom: 12px;
  margin-bottom: 24px;
}
.vc-sechead-proof { margin-bottom: 14px; }
.vc-sechead-row {
  display: flex;
  align-items: center;
  gap: 11px;
}
.vc-sechead-row h2 {
  margin: 0;
  font-size: 23px;
  font-weight: 620;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.vc-sechead-row .vc-sub {
  margin-left: auto;
  font-family: var(--vc-mono);
  font-size: 10.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--vc-ink-4);
}
@media (max-width: 520px) {
  .vc-sechead-row { align-items: flex-start; }
  .vc-sechead-row h2 { flex: 1 1 auto; }
  .vc-sechead-row .vc-sub { padding-top: 4px; }
}
```

- [ ] **Step 4: Run all web tests and lint**

Run: `pnpm --filter web test && pnpm --filter web lint`

Expected: all web tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/landing/SectionHead.tsx apps/web/components/landing/proofSurfaces.test.tsx apps/web/app/global.css
git commit -m "feat(site): add proof rails to landing sections"
```

---

### Task 3: Website and Documentation Sidebar Rule Marks

**Files:**
- Create: `apps/web/components/site/SidebarProofMarks.tsx`
- Create: `apps/web/components/site/SidebarProofMarks.test.tsx`
- Modify: `apps/web/components/site/SiteSidebar.tsx`
- Modify: `apps/web/lib/layout.shared.tsx`
- Modify: `apps/web/app/global.css`

**Interfaces:**
- Consumes: `StructuralRuleMark` from Task 1.
- Produces: `SidebarRailTerminals()` for vertical outer rails.
- Produces: `SidebarBoundary({ className? })` for colored navigation/footer group breaks.
- Preserves: sidebar links, active route behavior, drawer interactions, and Fumadocs layout configuration.

- [ ] **Step 1: Write failing sidebar mark tests**

Create `SidebarProofMarks.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { SidebarBoundary, SidebarRailTerminals } from './SidebarProofMarks'

describe('sidebar proof marks', () => {
  it('terminates the outer rail with neutral cut marks', () => {
    const markup = renderToStaticMarkup(<SidebarRailTerminals />)

    expect(markup.match(/data-vc-structural-rule="vertical"/g)).toHaveLength(2)
    expect(markup).not.toContain('data-vc-rule-color="true"')
  })

  it('marks meaningful sidebar group breaks with a compact proof nib', () => {
    const markup = renderToStaticMarkup(<SidebarBoundary />)

    expect(markup).toContain('data-vc-sidebar-boundary')
    expect(markup).toContain('data-vc-rule-color="true"')
  })
})
```

- [ ] **Step 2: Run the sidebar test and verify red**

Run: `pnpm --filter web exec vitest run components/site/SidebarProofMarks.test.tsx`

Expected: FAIL because `SidebarProofMarks.tsx` does not exist.

- [ ] **Step 3: Implement and place sidebar marks**

Create `SidebarProofMarks.tsx`:

```tsx
import { StructuralRuleMark } from '@/components/brand/ProofMarks'

export const SidebarRailTerminals = () => (
  <span className="vc-side-rail-marks" aria-hidden="true">
    <StructuralRuleMark className="vc-side-rail-mark vc-side-rail-mark-top" orientation="vertical" />
    <StructuralRuleMark className="vc-side-rail-mark vc-side-rail-mark-bottom" orientation="vertical" />
  </span>
)

export const SidebarBoundary = ({ className = '' }: { readonly className?: string }) => (
  <StructuralRuleMark
    className={`vc-side-boundary ${className}`.trim()}
    orientation="horizontal"
    color
  />
)
```

Place `SidebarRailTerminals` inside desktop `.vc-side` and mobile `.vc-side-drawer`. Place `SidebarBoundary` before the Resources group and inside both custom and docs sidebar footers. Add the same classes to the Fumadocs shell through `DocsSidebarFooter`.

Use these exact compositions in `SiteSidebar.tsx`:

```tsx
const SidebarFooter = ({ data }: { data: SidebarData }) => (
  <>
    <SidebarBoundary className="vc-side-boundary-footer" />
    <div className="vc-side-footer">{/* existing footer content */}</div>
  </>
)

// In SidebarBody, immediately before Resources:
<SidebarBoundary className="vc-side-boundary-resources" />
<div className="vc-side-grouplabel">Resources</div>

// First child of both desktop and drawer asides:
<SidebarRailTerminals />
```

Use the matching composition in `DocsSidebarFooter`:

```tsx
<SidebarRailTerminals />
<SidebarBoundary className="vc-side-boundary-resources" />
<div className="vc-side-grouplabel">Resources</div>
{/* existing resource list */}
<SidebarBoundary className="vc-side-boundary-footer" />
<div className="vc-side-footer">{/* existing proof version and GitHub */}</div>
```

Update CSS so outer terminals sit on the existing right border, group boundaries span the available sidebar width, CMYK nibs are 4px high, nested `.vc-side-sub` guide lines gain neutral endpoint ticks through pseudo-elements, and mobile top-bar/drawer boundaries remain clear of the 40×40px navigation controls.

```css
.vc-side,
.vc-side-drawer,
.vc-docs #nd-sidebar { isolation: isolate; }
.vc-side-rail-marks {
  position: absolute;
  inset: 0 -1px 0 auto;
  width: 8px;
  pointer-events: none;
}
.vc-side-rail-mark { position: absolute; right: 0; }
.vc-side-rail-mark-top { top: 10px; }
.vc-side-rail-mark-bottom { bottom: 10px; transform: scaleY(-1); }
.vc-side-boundary {
  margin: 12px 9px 6px;
  width: calc(100% - 18px);
  pointer-events: none;
}
.vc-side-boundary-footer { margin-block: 0; }
.vc-side-sub { position: relative; }
.vc-side-sub::before,
.vc-side-sub::after {
  content: '';
  position: absolute;
  left: -1px;
  width: 6px;
  height: 1px;
  background: var(--vc-line-2);
}
.vc-side-sub::before { top: 0; }
.vc-side-sub::after { bottom: 0; }
```

- [ ] **Step 4: Run sidebar tests, all web tests, and lint**

Run: `pnpm --filter web exec vitest run components/site/SidebarProofMarks.test.tsx && pnpm --filter web test && pnpm --filter web lint`

Expected: all web tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/site/SidebarProofMarks.tsx apps/web/components/site/SidebarProofMarks.test.tsx apps/web/components/site/SiteSidebar.tsx apps/web/lib/layout.shared.tsx apps/web/app/global.css
git commit -m "feat(site): mark sidebar structural rules"
```

---

### Task 4: Widget Major and Minor Proof Dividers

**Files:**
- Modify: `packages/react/src/panels/ui/ProofMarks.tsx`
- Modify: `packages/react/src/panels/ui/ProofMarks.test.tsx`
- Modify: `packages/react/src/panels/ui/typography.ts`
- Modify: `packages/react/src/panels/monitor/MonitorView.tsx`
- Modify: `packages/react/src/panels/monitor/MonitorProofDetails.test.tsx`

**Interfaces:**
- Produces: `ProofDivider({ kind? })`, where `kind` is `'major' | 'minor'` and defaults to `'major'`.
- Produces: `SECTION_GAP` and `SUBSECTION_GAP` layout styles without embedded borders.
- Preserves: monitor content order, current 14px/11px vertical spacing, all issue/audit interactions, and the top/pill registers.

- [ ] **Step 1: Write failing widget divider tests**

Add to `ProofMarks.test.tsx`:

```tsx
import {
  PillProofRegister,
  ProofControlStrip,
  ProofDivider,
  TopProofRegister,
} from './ProofMarks.js'

it('renders colored major dividers and neutral minor cut dividers', () => {
  const { container } = render(
    <>
      <ProofDivider kind="major" />
      <ProofDivider kind="minor" />
    </>,
  )

  expect(container.querySelectorAll('[data-wcgw-proof-divider="major"]')).toHaveLength(1)
  expect(container.querySelectorAll('[data-wcgw-proof-divider="minor"]')).toHaveLength(1)
  expect(container.querySelector('[data-wcgw-proof-divider="major"] [data-wcgw-proof-patch]')).not.toBeNull()
  expect(container.querySelector('[data-wcgw-proof-divider="minor"] [data-wcgw-proof-patch]')).toBeNull()
})
```

Add to `MonitorProofDetails.test.tsx`:

```tsx
expect(container.querySelectorAll('[data-wcgw-proof-divider="major"]')).toHaveLength(2)
expect(container.querySelectorAll('[data-wcgw-proof-divider="minor"]')).toHaveLength(1)
```

- [ ] **Step 2: Run focused React tests and verify red**

Run: `pnpm --filter @wcgw/vibe-check exec vitest run src/panels/ui/ProofMarks.test.tsx src/panels/monitor/MonitorProofDetails.test.tsx`

Expected: FAIL because `ProofDivider` and divider markers do not exist.

- [ ] **Step 3: Implement `ProofDivider` and replace raw borders**

Add to `panels/ui/ProofMarks.tsx`:

```tsx
export const ProofDivider = memo(({ kind = 'major' }: { readonly kind?: 'major' | 'minor' }) => (
  <span
    data-wcgw-proof-divider={kind}
    aria-hidden="true"
    style={{ display: 'flex', alignItems: 'center', gap: 5, width: '100%', height: 8, pointerEvents: 'none' }}
  >
    <CropTicks size={8} />
    {kind === 'major' ? <ProofControlStrip compact /> : null}
    <span style={{ height: 1, flex: 1, minWidth: 8, background: kind === 'major' ? T.border : T.borderSubtle }} />
  </span>
))
```

Replace `DIVIDER` and `FINE` in `typography.ts` with spacing-only exports:

```ts
export const SECTION_GAP: CSSProperties = { paddingTop: 14, marginTop: 4 }
export const SUBSECTION_GAP: CSSProperties = { paddingTop: 11, marginTop: 11 }
```

In `MonitorView.tsx`, import `ProofDivider`, `SECTION_GAP`, and `SUBSECTION_GAP`, then use these exact wrapper shapes:

```tsx
<div style={{ ...SUBSECTION_GAP, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
  <span style={{ gridColumn: '1 / -1' }}><ProofDivider kind="minor" /></span>
  {/* existing vital and memory Stat children */}
</div>

<div style={{ ...SECTION_GAP, paddingBottom: 14 }}>
  <ProofDivider kind="major" />
  <div style={{ ...SUBKICKER, marginTop: 8 }}>audits</div>
  {/* existing audit grid */}
</div>

{panels.has('issues') ? (
  <div style={SECTION_GAP}>
    <ProofDivider kind="major" />
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 }}>
      {/* existing proof-marks heading and CTA */}
    </div>
    {/* existing console and issue content */}
  </div>
) : null}
```

- [ ] **Step 4: Run all React tests and lint**

Run: `pnpm --filter @wcgw/vibe-check test && pnpm --filter @wcgw/vibe-check lint`

Expected: all React tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit**

```bash
git add packages/react/src/panels/ui/ProofMarks.tsx packages/react/src/panels/ui/ProofMarks.test.tsx packages/react/src/panels/ui/typography.ts packages/react/src/panels/monitor/MonitorView.tsx packages/react/src/panels/monitor/MonitorProofDetails.test.tsx
git commit -m "feat(widget): decorate structural dividers"
```

---

### Task 5: Integrated Verification and Visual Density Review

**Files:**
- Modify only if a scoped defect is found, with a failing regression test first.

**Interfaces:**
- Verifies the combined website/widget separator system; introduces no new public API.

- [ ] **Step 1: Run complete automated verification**

Run: `pnpm test && pnpm lint && pnpm --filter web lint && pnpm build`

Expected: all tests PASS, all TypeScript checks exit 0, and every workspace build succeeds.

- [ ] **Step 2: Start the integrated preview**

Build the packages consumed by the website:

```bash
pnpm --filter @wcgw/vibe-check-core build
pnpm --filter @wcgw/vibe-check build
pnpm --filter web exec next dev --webpack -p 3300
```

Expected: Next reports `Ready` at `http://localhost:3300`.

- [ ] **Step 3: Inspect the required browser states**

Using the Playwright CLI, capture and inspect:

- Landing page at 1440×1000 with all six section rails.
- Landing page with expanded widget showing two major proof dividers and one minor cut divider.
- Documentation page showing matched outer-rail terminals and Resources/footer boundary.
- Mobile landing and open drawer at 390×844.

Verify `document.documentElement.scrollWidth === document.documentElement.clientWidth`, proof marks do not overlap content or controls, sidebar marks stay outside hit areas, CMYK remains limited to major boundaries, and the browser console has zero errors.

- [ ] **Step 4: Review reduced-motion and accessibility invariants**

Confirm all new separator marks render `aria-hidden="true"`, remain non-interactive, and add no animation. Confirm the existing reduced-motion rule continues to disable plate-separation transforms without hiding the static dividers.

- [ ] **Step 5: Confirm clean worktree**

Run: `git status --short && git diff --check`

Expected: no tracked modifications and no whitespace errors. Existing repository-root user files remain untracked and untouched.
