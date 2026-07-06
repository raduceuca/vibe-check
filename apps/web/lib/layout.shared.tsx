import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared'
import { GITHUB_URL } from './site'

// Shared options for the Fumadocs layouts (docs sidebar header, top-nav links,
// GitHub link). The links mirror the SiteHeader used on the landing and /fix
// sections so the whole site shares one nav: Home · Fix guides · Docs · GitHub.
export const baseOptions = (): BaseLayoutProps => ({
  nav: {
    title: (
      <span style={{ fontWeight: 600, letterSpacing: '-0.01em' }}>
        vibe&#8202;check
      </span>
    ),
    url: '/',
  },
  links: [
    { text: 'Fix guides', url: '/fix', active: 'nested-url' },
    { text: 'Docs', url: '/docs', active: 'nested-url' },
  ],
  githubUrl: GITHUB_URL,
})
