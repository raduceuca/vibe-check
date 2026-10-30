import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { SITE_URL, GITHUB_URL } from '@/lib/site'
import { mono, sans, serif } from './fonts'
import './global.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VibeCheck — performance and SEO overlay for AI-built apps',
    template: '%s · VibeCheck',
  },
  description:
    'A dev overlay that checks your AI-built frontend for jank, bloat, leaks and SEO/AEO gaps, sends the issue you pick to your coding agent, and verifies the fix.',
  // Authorship / freshness signals for answer engines (dogfoods aeo's
  // author-metadata check site-wide → renders <meta name="author">).
  authors: [{ name: 'Radu Ceuca', url: GITHUB_URL }],
  creator: 'Radu Ceuca',
  publisher: 'VibeCheck',
  openGraph: {
    type: 'website',
    siteName: 'VibeCheck',
    url: SITE_URL,
    title: 'Your agent built it. You decide if it ships.',
    description:
      'A dev overlay that checks your AI-built frontend for jank, bloat, leaks and SEO/AEO gaps, sends the issue you pick to your coding agent, and verifies the fix.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Your agent built it. You decide if it ships.',
    description:
      'A dev overlay that checks your AI-built frontend for jank, bloat, leaks and SEO/AEO gaps, sends the issue you pick to your coding agent, and verifies the fix.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html
    lang="en"
    className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    suppressHydrationWarning
  >
    <body
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
      }}
    >
      <RootProvider
        search={{ enabled: false }}
        theme={{ defaultTheme: 'light', enableSystem: false }}
      >
        {children}
      </RootProvider>
    </body>
  </html>
)

export default RootLayout
