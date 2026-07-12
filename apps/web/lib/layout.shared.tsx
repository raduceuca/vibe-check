import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { GITHUB_URL } from './site'
import { SITE_VERSION } from './nav'
import { GithubMark, ExtArrow } from '@/components/site/navIcons'

// Shared config for the Fumadocs docs layout. The docs sidebar is skinned (in
// global.css, under .vc-docs) to match the marketing SiteSidebar, so the whole
// site reads as one nav. Here we feed it the same pieces:
//   • nav.title  → the "vibe check" wordmark (status dot + name) + version badge
//   • links      → the primary destinations (Home · Scan · Fix guides · Docs)
//   • DocsSidebarFooter → the Resources group + the version / GitHub footer
// (rendered into the sidebar's `footer` slot by app/docs/layout.tsx).

export const baseOptions = (): BaseLayoutProps => ({
  nav: {
    title: (
      <>
        <span className="vc-side-brand-dot" aria-hidden="true" />
        <span className="vc-side-brand-name">
          vibe<span className="vc-side-brand-2">check</span>
        </span>
        <span className="vc-side-ver-badge vc-mono">{SITE_VERSION}</span>
      </>
    ),
    url: '/',
  },
  links: [
    { text: 'Home', url: '/', active: 'url' },
    { text: 'Scan', url: '/scan', active: 'url' },
    { text: 'Fix guides', url: '/fix', active: 'nested-url' },
    { text: 'Docs', url: '/docs', active: 'nested-url' },
  ],
})

// The Resources group + version footer, injected into the docs sidebar's `footer`
// slot so it mirrors the SiteSidebar footer.
export const DocsSidebarFooter = () => (
  <>
    <div className="vc-side-grouplabel">Resources</div>
    <ul className="vc-side-list">
      <li>
        <a
          className="vc-side-row vc-side-row-l0"
          href={`${GITHUB_URL}/releases`}
          target="_blank"
          rel="noreferrer"
        >
          <span className="vc-side-tick" aria-hidden="true" />
          <span className="vc-side-label">Changelog</span>
          <ExtArrow />
        </a>
      </li>
      <li>
        <a
          className="vc-side-row vc-side-row-l0"
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
        >
          <span className="vc-side-tick" aria-hidden="true" />
          <span className="vc-side-label">GitHub</span>
          <ExtArrow />
        </a>
      </li>
    </ul>
    <div className="vc-side-footer">
      <span>v{SITE_VERSION}</span>
      <span aria-hidden="true">·</span>
      <a
        className="vc-side-foot-gh"
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="VibeCheck on GitHub"
      >
        <GithubMark />
      </a>
    </div>
  </>
)
