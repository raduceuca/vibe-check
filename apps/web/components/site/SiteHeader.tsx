import Link from 'next/link'
import { NAV_LINKS } from '@/lib/site'

// ── Shared top nav ───────────────────────────────────────────────────────────
// A quiet, hairline-ruled header shared across the landing page and the /fix
// section (docs get the equivalent links through the Fumadocs nav). Pure Server
// Component — no client JS. `active` dims the link for the current section.

export const SiteHeader = ({ active }: { active?: string }) => (
  <header className="vc-site-header">
    <div className="vc-site-header-inner">
      <Link href="/" className="vc-site-brand" aria-label="VibeCheck home">
        <span className="vc-site-dot" aria-hidden="true" />
        vibe<span className="vc-site-brand-2">check</span>
      </Link>
      <nav className="vc-site-nav" aria-label="Primary">
        {NAV_LINKS.filter((l) => l.href !== '/').map((l) =>
          l.external ? (
            <a
              key={l.href}
              href={l.href}
              className="vc-site-link"
              target="_blank"
              rel="noreferrer"
            >
              {l.label}
            </a>
          ) : (
            <Link
              key={l.href}
              href={l.href}
              className="vc-site-link"
              aria-current={active === l.href ? 'page' : undefined}
            >
              {l.label}
            </Link>
          ),
        )}
      </nav>
    </div>
  </header>
)
