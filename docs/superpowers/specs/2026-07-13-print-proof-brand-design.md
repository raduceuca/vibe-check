# Print-Proof Brand Design

## Objective

Give the public website and React widget a recognizable prepress identity inspired by registration targets, crop geometry, tint scales, and CMYK process calibration while preserving the product's existing modern refinement.

The result must feel like a contemporary diagnostic instrument with a print-production signature. It must not feel retro, distressed, cartoonish, or like a themed component library.

## Approved Direction

The approved direction is **preservation first**:

- Keep the current information architecture, layout, typography, spacing, radii, soft elevation, card construction, and widget dimensions.
- Keep automatic light and dark modes for both the public website and embeddable widget.
- Add the print-proof identity only at authored signature moments.
- Use black/K as the dominant visual ink. CMYK is evidence and process, not decoration.
- Use hairline geometry only. Do not introduce thick outlined rectangles or hard cartoon-like panels.

## Visual System

### Process palette

Define theme-aware cyan, magenta, yellow, and black process tokens independently for the website and widget. Light mode uses crisp process colors against the existing white substrate. Dark mode uses brighter, lower-opacity process colors that remain legible without glowing.

Process colors do not replace semantic status colors. Green, amber, orange, and red continue to communicate health and severity. CMYK communicates brand and registration behavior.

### Geometry

Registration targets use concentric circles, crosshairs, and a center point with one-pixel strokes. Crop fragments are partial corners rather than complete frames. Calibration rails are short, two-to-three-pixel process strips, not page-wide bands.

All geometry is decorative and hidden from assistive technology. It must never intercept pointer input or change layout measurements.

### Motion

Healthy/resting states are visually registered. On bestiary hover/focus and genuine widget fault states, selected process layers separate by 0.5–1px. Transitions remain interruptible and subtle. Reduced-motion mode removes the separation transition and presents the aligned state.

## Public Website

### Landing hero

Preserve the current hero copy, type scale, install command, sidebar, and content width. Add:

- one short CMYK proof rail adjacent to the existing eyebrow;
- one large but low-contrast registration constellation in the hero's existing negative space;
- one partial crop fragment aligned to the content column.

The constellation is the primary new brand moment. It must remain quiet enough that the headline and live widget retain hierarchy. The future logo can replace or absorb this mark without requiring another layout redesign.

### Shared surfaces

Expose the process palette as site tokens so scan, fix, and documentation surfaces can use the same signature where appropriate. Do not reskin every page or component. Existing sidebar states, cards, diagrams, code blocks, and controls remain structurally unchanged.

### Bestiary

Keep the existing specimen-card surface, spacing, type, hover expansion, and catalogue information. Redraw all thirteen detector glyphs as process-aware instrument drawings:

- black/K remains the structural plate;
- cyan, magenta, and yellow are assigned selectively to arcs, echoes, ranges, ghosts, or repeated measurements that explain each detector;
- colors are not assigned by severity or card category;
- process layers separate by at most one pixel on hover/focus;
- a tiny four-ink calibration signature may appear in the existing card footer, without adding new card framing.

The illustrations should remain legible in monochrome if process-color support is absent.

## React Widget

### Shell and header

Preserve the 320px rounded shell, collapsed pill, header hierarchy, navigation, spacing, and shadows. Add a reusable miniature proof rail and registration mark to the header without increasing panel height or displacing the health label.

The collapsed pill receives only a very small proof signature; its metrics and tap target remain unchanged.

### Fault behavior

When active issues exist, the widget can expose controlled plate separation in one data-driven place:

- the SVG fallback FPS trace renders low-opacity cyan and magenta echoes offset by less than one pixel;
- the main canvas chart is left untouched because altering the third-party renderer would broaden scope and risk performance;
- issue rows and semantic severity markers remain unchanged.

When there are no active issues, the trace is fully registered. Reduced-motion mode disables the echoes.

### Theming and isolation

All widget styles remain inline except the existing injected, prefixed token stylesheet. New tokens and animation selectors use the `--wcgw-` prefix and stay scoped under `[data-wcgw]` so host-page CSS cannot leak in or out.

## Accessibility and Performance

- Decorative proof marks use `aria-hidden="true"`.
- No new interactive element is introduced.
- Existing focus behavior and minimum hit areas remain unchanged.
- Process color never carries semantic meaning by itself.
- Reduced-motion mode removes plate-separation animation.
- The website additions are static SVG/CSS and introduce no runtime dependency.
- The widget additions are tiny inline SVGs and do not change collector or detector behavior.

## Verification

Verify:

- TypeScript checks for `apps/web` and `packages/react`.
- React widget unit tests, including registered versus faulted SVG fallback behavior.
- Website production build.
- Full repository tests where feasible.
- Browser screenshots of the landing page at desktop and mobile widths in light and dark mode.
- Browser interaction checks for bestiary hover/focus, widget expanded/collapsed states, and reduced motion.
- No layout shift, horizontal overflow, or interception of clicks from decorative marks.

## Out of Scope

- Final logo integration; the logo will arrive separately.
- Rewriting site copy or information architecture.
- Replacing the current typeface or introducing webfont dependencies.
- Rebuilding the widget shell, navigation, charts, or issue-row UI.
- Distressed paper textures, halftone overlays, thick frames, hard rectangular cards, or retro-print simulation.
