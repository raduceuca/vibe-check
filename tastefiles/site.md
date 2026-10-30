# Taste brief — public site (`apps/web`) and showcase examples

Written 2026-10-26 from Radu's answers. Design subagents read this before
touching copy, layout, or examples. `PRODUCT.md` stays the source for
positioning facts; this file is the source for feel.

## Framing

**Now you can** vibe-code at full speed and still be the one who decides it
ships.

A vibe check is a human ritual: you look at the thing your agent built and
decide whether it passes. VibeCheck gives that ritual instruments. The agent is
the hands, you are the taste, VibeCheck is the evidence. The human stays in
control the whole way:

- VibeCheck **notices** (live, in the corner of your own dev server).
- **You decide** what goes back to the agent — nothing is sent on your behalf.
- The agent fixes.
- **The browser confirms** — a fix only counts when fresh snapshots say so.

"Flawless vibes" is concrete, not mystical. A product passes the vibe check
when it is:

- **Smooth** — no jank, long tasks, layout shift, sluggish input.
- **Light** — lean DOM, no duplicate fetches, no leaks, right-sized images and
  libraries.
- **Clean** — a quiet console, web essentials in place.
- **Findable** — passes the SEO audit.
- **Quotable** — passes the AEO audit (answer engines can read and cite it).

Use these as the organizing idea for detectors on the site. Plain product
language from `PRODUCT.md` still binds every sentence.

## Look: light editorial

- White canvas, pure neutrals, generous type and whitespace, long-form
  editorial rhythm. Calm and confident, not a dashboard.
- The live widget is the product shot. It is the only dark object on the page
  and it is really measuring the page the reader is on.
- Punch comes from type: size, weight, tracking, line rhythm. Headlines are one
  ink colour.
- Status colours (green / amber / red) appear only for real semantic state.
  Red is earned by a real caught fault.
- Show, don't tell: live controls that break the page, live readings, a real
  recorded round trip. No mock screenshots posing as live.

## Hard rejections

- Print / press / proof-sheet metaphor or chrome: crop ticks, registration
  marks, CMYK strips, plates, "proof", "press check", "misprint", "register".
- Two-colour or accent-split headlines; coloured words inside a sentence.
- Colour tints in backgrounds or body text; gradient blobs, glassmorphism,
  purple AI gradients, emoji bullets, generic icon-card feature grids.
- Readable copy under 14px.
- Invented traction: stars, logos, testimonials, benchmarks, "used by".
- Claiming a copied prompt was delivered. Only `watch_for_issue` confirms
  dispatch.

## References

None supplied. Do not cite external products as references in design notes;
judge against this brief and `PRODUCT.md`.
