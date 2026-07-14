import Link from 'next/link'

export const PressRosette = () => (
  <svg
    data-vc-press-rosette=""
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
    fill="none"
  >
    <g className="vc-press-rosette-c">
      <circle cx="10" cy="10" r="5.5" />
    </g>
    <g className="vc-press-rosette-m">
      <circle cx="10" cy="10" r="5.5" />
    </g>
    <g className="vc-press-rosette-k">
      <circle cx="10" cy="10" r="5.5" />
      <circle cx="10" cy="10" r="1.5" />
      <path d="M1 10h18M10 1v18" />
    </g>
  </svg>
)

export const NavigationWordmarkLabel = () => (
  <>
    <PressRosette />
    <span className="vc-side-brand-name">
      Vibe<span className="vc-side-brand-2">Check</span>
    </span>
  </>
)

export const NavigationWordmark = () => (
  <Link href="/" className="vc-side-brand" aria-label="VibeCheck home">
    <NavigationWordmarkLabel />
  </Link>
)

export const ProofVersion = ({ version }: { readonly version: string }) => (
  <span className="vc-proof-version" data-vc-proof-version="">
    <span className="vc-proof-version-rule" aria-hidden="true" />
    <span className="vc-proof-version-label">PROOF</span>
    <span>{version}</span>
  </span>
)
