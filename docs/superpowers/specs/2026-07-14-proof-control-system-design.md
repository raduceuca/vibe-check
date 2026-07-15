# Proof-Control System Design

## Objective

Turn the existing CMYK accents into an unmistakable prepress control language across the public site and embeddable widget. The result should feel authored, witty, and contemporary: a modern performance instrument carrying the visual evidence of a live press proof.

This is a refinement of the first print-proof pass. It preserves the current typography, rounded surfaces, spacing, shadows, semantic status colors, light/dark themes, and component footprints. It replaces the unexplained floating four-color dash with a deliberate top-edge control area and distributes small, useful proof details through the interface.

## Problems to Correct

- The current widget proof rail floats at the top-right of the header and reads as an arbitrary status stripe.
- The four equal CMYK dashes do not resemble the density patches, registration targets, crop fragments, or measurement ticks in real print-control references.
- The visual language appears only at a few isolated moments, so it does not yet feel like a coherent brand system.
- The first pass was too cautious about micro-decoration and missed opportunities in dividers, charts, cards, navigation, live metrics, code blocks, and section labels.

## Approved Direction

Combine three layers, in descending order of prominence:

1. **Press control strips** at the top edge of major instruments.
2. **Registration geometry** at component boundaries and live-data corners.
3. **Inspector annotations** as sparse, witty microcopy tied to real interface meaning.

The treatment must remain precise and contemporary. No distressed texture, thick frames, fake paper, hard cartoon rectangles, or decorative clutter. CMYK is a production signature, not a replacement for semantic health colors.

## Shared Visual Grammar

### Process patches

Replace equal color dashes with a compact proof strip containing varied patch widths and tonal steps. The strip uses cyan, magenta, yellow, and black plus neutral tint patches. Thin gaps make the elements read as discrete ink-density samples.

The visual order is stable and brand-specific. Fault state may separate selected process plates by less than one pixel, but the entire strip must not become a severity meter.

### Crop and register marks

Use partial crop corners, small registration crosshairs, one-pixel rules, and short measurement ticks. These elements sit on edges and intersections where production marks naturally belong. They never form a heavy enclosing frame.

### Microcopy

Use short labels that describe the interface as a live proof:

- `LIVE PROOF`
- `REGISTERED` or `OFF REGISTER`
- `PLATE 01/06`
- `K 100`
- `CHK 03`
- `READ / SAMPLE`

Labels stay under twelve characters where possible, use the existing mono face, and remain lower contrast than primary content. Copy is decorative only when hidden from assistive technology; meaningful status retains a normal accessible label.

## React Widget

### Top proof register

Remove the floating header dash. Add a dedicated top control register inside the 320px shell and above the title row. It is 10–12px high and does not alter the shell width.

The register contains:

- a left crop fragment;
- a compact varied-width CMYK/tint strip;
- a centered micro-label, `LIVE PROOF`;
- a right registration target;
- a fault-aware registration state expressed through sub-pixel process separation.

The register uses only hairlines and tiny patches. It should feel like the untrimmed edge of a press sheet without making the shell square or industrial.

### Collapsed pill

Remove the proof rail overlaying the pill metrics. Attach a miniature three-part proof register to the pill's top edge: a crop tick, short density strip, and register dot. It remains outside the metric flow and does not cover the issue count.

### Interior micro-details

Add a controlled set of recurring details:

- Monitor hero: `READ / SAMPLE` annotation and a small vertical calibration ruler beside the FPS chart.
- Section dividers: one short CMYK tick cluster at the start of the existing hairline, not a full-color divider.
- Audit score cells: tiny `CHK` plate numbers that remain secondary to the score.
- Issue rows: a registration crosshair replacing no semantic indicator; it appears only as a quiet terminal detail at the far edge.
- Bottom navigation: a small `PLATE 01/06` label above the active-tab hairline, while existing icons and hit areas remain unchanged.
- Settings and agent surfaces: sparse crop fragments on selected section headings, not on every row.

These details share reusable components so density and geometry remain consistent. They do not introduce new interactive controls.

## Public Website

### Hero proof header

Strengthen the current hero signature into a recognizable top proof header. Keep it above the headline and within the existing content column. It combines:

- the varied-width CMYK/tint strip;
- the existing eyebrow copy;
- a small `PROOF 01` label;
- crop fragments at both ends;
- the existing registration constellation in negative space.

The color strip should be the first visual evidence under the site header, not a tiny dash embedded ambiguously in the eyebrow.

### Components and sections

Extend the system across authored surfaces while retaining their current geometry:

- Section headings receive a numbered proof label and one edge tick.
- Live metric readouts receive miniature calibration rulers and `LIVE`/`SAMPLE` annotations.
- Bestiary cards keep their current process illustrations and gain varied density patches instead of the equal four-dash footer.
- Code/install blocks gain a small crop corner and a quiet `K 100` or `PLATE` notation in unused space.
- Pipeline diagrams receive tiny registration targets at key transfer points.
- CTA and fault-demo clusters get a small proof legend explaining that semantic red/green remains separate from process inks.
- Footer rules terminate in crop ticks rather than becoming colored bands.

The system is distributed, not uniform: every major section gets at most one or two proof details. Ordinary prose, navigation rows, and form controls remain clean.

## Components and Boundaries

Create small reusable primitives rather than duplicating SVG or inline styles:

- `ProofControlStrip`: varied density patches; site and widget implementations use their own prefixed tokens.
- `RegistrationTarget`: compact concentric target with optional fault separation.
- `CropTicks`: partial edge/corner geometry.
- `ProofLabel`: mono plate/check annotation.
- `CalibrationRuler`: short tick scale for chart and metric contexts.

Website primitives remain normal React/CSS components. Widget primitives use inline geometry and the existing injected `[data-wcgw]` stylesheet so host pages remain isolated.

## Behavior

- Resting state is registered and precise.
- Genuine active issues can offset cyan/magenta/yellow layers by 0.5–1px in the widget register and SVG trace.
- Website card hover/focus may separate process illustration layers as already implemented.
- Reduced-motion mode removes all registration movement and presents aligned plates.
- No decoration intercepts pointer input or changes the meaning of semantic status colors.

## Accessibility and Performance

- Pure decoration is `aria-hidden="true"` and unfocusable.
- Existing headings, labels, status text, and navigation names remain unchanged.
- CMYK never carries a pass/fail meaning on its own.
- No new runtime dependency is added.
- Exact transition properties are used; no `transition: all`.
- The widget remains 320px wide, the collapsed pill retains its metric layout, and website additions do not cause horizontal overflow.

## Testing and Verification

- Unit-test the density strip structure, top-register placement contract, fault-state attributes, and decorative accessibility.
- Update widget shell tests to prove the proof register precedes the header and does not alter the 320px width.
- Update site tests to prove the hero proof header contains crop, strip, label, and registration elements.
- Run widget and website type checks, tests, and production builds.
- Browser-check desktop/mobile and light/dark modes.
- Verify the collapsed pill does not cover metrics, the expanded register reads as a top strip, and no horizontal overflow appears.
- Verify reduced motion returns all process plates to `transform: none`.

## Out of Scope

- Final logo integration.
- New typography or webfont dependencies.
- Rebuilding widget navigation, information architecture, charts, or detector logic.
- Adding texture, paper simulation, thick strokes, square shells, or retro-print skeuomorphism.
