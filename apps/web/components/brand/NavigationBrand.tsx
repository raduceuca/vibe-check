import Link from 'next/link'

export const BrandMark = () => (
  <svg
    data-vc-brand-mark=""
    viewBox="0 0 20 20"
    width="20"
    height="20"
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
    <span className="vc-side-brand-name">VibeCheck</span>
  </>
)

export const NavigationWordmark = () => (
  <Link href="/" className="vc-side-brand" aria-label="VibeCheck home">
    <NavigationWordmarkLabel />
  </Link>
)

/** Package version badge. Renders `v{version}` from the release pin. */
export const SiteVersion = ({ version }: { readonly version: string }) => (
  <span className="vc-site-version" data-vc-site-version="">
    {version.startsWith('v') ? version : `v${version}`}
  </span>
)

/** @deprecated Prefer SiteVersion — kept for sidebar/docs until they migrate. */
export const ProofVersion = SiteVersion

