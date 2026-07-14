# Proof Divider System

## Objective

Turn the printing-proof language into a structural separator system across the public website, documentation shell, and React widget. The marks should explain hierarchy and terminate existing rules, not behave like standalone decoration.

The interface remains contemporary: fine neutral rules, soft surfaces, generous spacing, and restrained CMYK accents. No thick outlined containers, vintage-paper treatment, or cartoon press imagery.

## Density hierarchy

Three separator treatments establish a consistent visual grammar:

1. **Major proof rail** — complete crop tick, CMYK control strip, proof label, flexible hairline, and registration target.
2. **Structural rule mark** — neutral crop/cut ticks terminating a persistent horizontal or vertical boundary, with one compact CMYK nib at a meaningful group break.
3. **Minor cut tick** — a small neutral terminal on subordinate dividers; no color.

CMYK appears only at major boundaries and section changes. Minor rules stay neutral so the page does not become noisy.

## Public landing page

Every numbered landing section receives a compact major proof rail above its title:

`crop tick · CMYK control strip · PROOF 01–06 · flexible rule · registration target`

- The hero retains the existing larger `PROOF 01` register.
- The six content sections use the same composition at a slightly quieter scale.
- Section numbering reads `PROOF 01–06`; the current inline `PLATE 01–06` index is removed from the title row to avoid duplicate numbering.
- The section title and right-aligned subtitle remain on their own clean row beneath the proof rail.
- Existing section spacing and title typography remain unchanged unless optical adjustment is required after the rail is inserted.
- On mobile, the rail remains on one line. The flexible rule absorbs width pressure before marks or labels shrink.

## Website and documentation sidebars

Persistent sidebar rules gain proof-production terminals without becoming framed panels:

- The outer vertical sidebar rule receives neutral cut marks near its top and bottom endpoints.
- The navigation-to-resources break and footer boundary receive a compact four-color proof nib anchored to the existing hairline.
- Nested navigation guide lines receive neutral terminal ticks only; they do not receive CMYK.
- The custom website sidebar and Fumadocs documentation sidebar use the same positions, sizes, and opacity.
- Mobile top-bar and drawer boundaries use neutral cut marks plus a single compact proof nib; marks must stay clear of the wordmark and navigation buttons.

## React widget

The widget extends its existing proof-register vocabulary into internal structure:

- Major `DIVIDER` boundaries receive a reusable inline-style proof divider: small top-left crop tick, compact four-color nib, and the existing flexible hairline.
- Minor `FINE` separators receive a neutral cut tick only.
- The expanded widget’s existing top register and collapsed pill register remain unchanged and establish the largest and smallest endpoints of the scale.
- The internal divider marks are decorative and `aria-hidden`; they cannot change reading order or interaction semantics.
- Faulted plate-separation behavior remains limited to the existing top and pill proof registers. Static internal dividers do not animate or separate when faults are present.

## Reusable primitives

### Website

- Extend `SectionHead` to render the compact numbered proof rail through the existing proof-mark primitives.
- Add one reusable structural rule-mark primitive for horizontal and vertical rule terminals, rather than implementing unrelated pseudo-elements in each consumer.
- Reuse `ProofControlStrip`, `CropTicks`, `ProofLabel`, and `RegistrationTarget`; do not introduce a second CMYK patch definition.

### Widget

- Add a `ProofDivider` component to the existing inline-style `panels/ui/ProofMarks.tsx` module.
- Replace the shared `DIVIDER` and `FINE` usages at major monitor boundaries with the new component or a composed wrapper. Preserve the inline-style-only package rule.
- Keep layout styles and mark rendering separate so divider spacing remains explicit at each consumer.

## Visual specifications

| Treatment | CMYK height | Crop/target scale | Rule |
| --- | ---: | ---: | --- |
| Hero proof rail | 7px | 13px / 22px | Existing full-width hairline |
| Section proof rail | 5px | 10px / 16px | Full available width |
| Sidebar proof nib | 4px | 8px cut terminal | Existing sidebar boundary |
| Widget major divider | 4px | 8px cut terminal | Existing major divider |
| Minor cut tick | None | 6–8px | Existing subordinate rule |

Patch widths remain varied. CMYK is the only decorative color system. Neutral cut marks use the current muted rule tokens.

## Responsive and accessibility behavior

- Decorative proof and cut marks are `aria-hidden` and non-interactive.
- No mark overlaps a link, button, heading, label, or metric.
- The sidebar rail stays outside navigation hit areas.
- Horizontal separators never create overflow at 390px.
- The mobile header keeps a minimum 40×40px navigation-button hit area.
- Reduced-motion behavior remains unchanged because the new internal marks are static.

## Testing and verification

- Add component tests asserting all numbered `SectionHead` instances render a major proof rail and no longer duplicate `PLATE` numbering.
- Add sidebar tests for structural rule marks in desktop, mobile, drawer, and documentation footer compositions.
- Add widget tests for major proof dividers and neutral minor cut ticks.
- Run web and React tests, TypeScript checks, and the full monorepo build.
- Visually review desktop landing, collapsed and expanded widget, documentation sidebar, and 390px mobile navigation.
- Verify the document has no horizontal overflow and the browser console has no new errors.

## Out of scope

- Reworking typography, button shapes, cards, navigation content, or widget information architecture.
- Adding animation to divider marks.
- Decorating every card border or every one-pixel rule with CMYK.
- Changing detector behavior, metric collection, or MCP data flow.
