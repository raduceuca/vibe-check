import Link from 'next/link'
import { BrandMark } from '@/components/brand/NavigationBrand'
import { ExtArrow } from '@/components/site/navIcons'
import { SiteMenu } from '@/components/site/SiteMenu'
import { GITHUB_URL } from '@/lib/site'

const navLinkClass = 'vc-topbar-link'
const installHref = (path: 'home' | 'scan') => (path === 'scan' ? '/#install' : '#install')

export const SiteTopBar = ({
  install = 'home',
}: {
  readonly install?: 'home' | 'scan'
}) => (
  <>
    <a className="vc-skip" href="#main">
      Skip to content
    </a>
    <header className="vc-topbar">
      <div className="vc-topbar-inner">
        <Link href="/" className="vc-topbar-brand" aria-label="VibeCheck home">
          <BrandMark />
          <span className="vc-topbar-wordmark">VibeCheck</span>
        </Link>

        <nav className="vc-topbar-nav" aria-label="Primary">
          <Link className={navLinkClass} href="/fix">
            Fix guides
          </Link>
          <Link className={navLinkClass} href="/docs">
            Docs
          </Link>
          <Link className={navLinkClass} href="/scan">
            Scan a URL
          </Link>
          <a
            className={navLinkClass}
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
          >
            GitHub
            <span aria-hidden="true">
              {' '}
              <ExtArrow />
            </span>
          </a>
          <Link className="vc-btn vc-btn-outline vc-topbar-install" href={installHref(install)}>
            Install
          </Link>
        </nav>

        <div className="vc-topbar-mobile">
          <Link className="vc-btn vc-btn-outline vc-topbar-install" href={installHref(install)}>
            Install
          </Link>
          <SiteMenu />
        </div>
      </div>
    </header>
  </>
)
