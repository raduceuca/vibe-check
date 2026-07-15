import type { ReactNode } from 'react'

// ── issueArt kit ─────────────────────────────────────────────────────────────
// Shared geometry + ink language for the 13 detector glyphs shown in the
// "What it catches" grid. ONE viewBox (48²), ONE stroke width, ONE opacity
// ladder — so the whole set reads as a single system and sits beside the Quiet
// Instrument diagram kit (see components/diagrams/primitives.tsx) without
// clashing.
//
// Structural/K ink is painted with `currentColor`. Selected signal geometry is
// wrapped in ProcessPlate so the mechanism can use theme-aware CMY inks without
// turning the whole card into a colour-coded severity surface. Pure SVG, no
// hooks — safe inside a server component.

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

export type ProcessInk = 'cyan' | 'magenta' | 'yellow'

const PROCESS_VAR: Record<ProcessInk, string> = {
  cyan: 'var(--vc-proof-c)',
  magenta: 'var(--vc-proof-m)',
  yellow: 'var(--vc-proof-y)',
}

export const ProcessPlate = ({
  ink,
  children,
}: {
  readonly ink: ProcessInk
  readonly children: ReactNode
}) => (
  <g data-vc-process-plate={ink} style={{ color: PROCESS_VAR[ink] }}>
    {children}
  </g>
)

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
