import Link from 'next/link'

export const BrandMark = () => (
  <svg
    data-vc-brand-mark=""
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
    fill="none"
  >
    <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
    <path
      d="M6.6 10.2l2.3 2.3 4.6-5.3"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

export const NavigationWordmarkLabel = () => (
  <>
    <BrandMark />
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
    <span>{version}</span>
  </span>
)
