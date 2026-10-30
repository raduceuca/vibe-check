import Link from 'next/link'
import { SiteVersion } from '@/components/brand/NavigationBrand'
import { GITHUB_URL } from '@/lib/site'
import { SITE_VERSION } from '@/lib/nav'

const FOOTER_LINKS = [
  { label: 'Docs', href: '/docs' },
  { label: 'Quickstart', href: '/docs/quickstart' },
  { label: 'Fix guides', href: '/fix' },
  { label: 'Scan a URL', href: '/scan' },
  { label: 'Examples', href: '/docs/examples' },
  { label: 'MCP tools', href: '/docs/reference/mcp-tools' },
  { label: 'llms.txt', href: '/llms.txt' },
  { label: 'Changelog', href: `${GITHUB_URL}/releases`, external: true },
  { label: 'GitHub', href: GITHUB_URL, external: true },
  { label: 'npm', href: 'https://www.npmjs.com/package/@wcgw/vibe-check', external: true },
] as const

export const SiteFooter = () => (
  <footer className="vc-footer">
    <p className="vc-footer-lead">Keep building fast. Keep the final say.</p>
    <p className="vc-footer-line">
      Open source under MIT. Zero runtime dependencies in core. Runs on your machine: no account, no hosted service.
    </p>
    <nav className="vc-footer-links" aria-label="Footer">
      {FOOTER_LINKS.map((item, index) => (
        <span key={item.href}>
          {index > 0 && <span aria-hidden="true"> · </span>}
          {'external' in item && item.external ? (
            <a href={item.href} target="_blank" rel="noreferrer">
              {item.label}
            </a>
          ) : (
            <Link href={item.href}>{item.label}</Link>
          )}
        </span>
      ))}
    </nav>
    <p className="vc-footer-byline">
      Made by{' '}
      <a href="https://github.com/raduceuca" target="_blank" rel="noreferrer">
        Radu Ceuca
      </a>
      <span aria-hidden="true"> · </span>
      <SiteVersion version={SITE_VERSION} />
    </p>
  </footer>
)
