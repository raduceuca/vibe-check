import type { ReactNode } from 'react'

// ── issueArt kit ─────────────────────────────────────────────────────────────
// Shared geometry + ink language for the 13 detector glyphs shown in the
// "What it catches" grid. ONE viewBox (48²), ONE stroke width, ONE opacity
// ladder — so the whole set reads as a single system and sits beside the Quiet
// Instrument diagram kit (see components/diagrams/primitives.tsx) without
// clashing.
//
// Neutral ink is painted with `currentColor` + opacity (currentColor === the
// card's --vc-ink, set on the .vc-art container). The single accent per glyph is
// the fault/signal, driven by the card's own `--vc-fire` custom property — which
// the DetectorsGrid CSS already sets to red at data-sev=error and amber at
// data-sev=warning. That ties each illustration to its card's severity dot +
// hover with zero prop threading, and stays theme-aware because --vc-fire
// resolves through the theme's --vc-sig / --vc-amber tokens. Pure SVG, no hooks —
// safe inside a server component.

export const VIEW = 48
export const STROKE = 1.5

// ONE flat colour, no fills. The glyphs are single-tone monoline drawings — the
// shape alone carries the concept; the card's severity dot carries the colour.
// Every INK step resolves to the same tone (so old strong/mid/soft callsites
// still work but render identically) and fills are off. Painted with
// currentColor === the card's --vc-ink, so it stays theme-aware.
const TONE = 0.85
export const INK = {
  strong: TONE,
  mid: TONE,
  soft: TONE,
  fill: 0, // no fills
} as const

// The former per-glyph accent is folded into the single tone — no second colour.
export const FIRE = 'currentColor'
export const FIRE_OP = TONE
export const FIRE_FILL = 0

interface ArtSvgProps {
  readonly children: ReactNode
}

// Decorative shell: the detector name already labels the card, so the glyph is
// aria-hidden (no redundant screen-reader noise). Fluid to its ~46px container;
// hairline strokes, round joins, no fill by default.
export const ArtSvg = ({ children }: ArtSvgProps) => (
  <svg
    viewBox={`0 0 ${VIEW} ${VIEW}`}
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth={STROKE}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'block', width: '100%', height: '100%' }}
  >
    {children}
  </svg>
)
