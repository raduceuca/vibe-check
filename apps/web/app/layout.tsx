import type { ReactNode } from 'react'
import type { Metadata, Viewport } from 'next'
import { RootProvider } from 'fumadocs-ui/provider/next'
import { SITE_URL, GITHUB_URL } from '@/lib/site'
import './global.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VibeCheck — your agent shipped it, this caught what it broke',
    template: '%s · VibeCheck',
  },
  description:
    'A quiet performance instrument for the AI-built frontend. It runs in the corner, catches jank, leaks, DOM bloat, layout shift and failing audits — and hands the evidence straight to your coding agent.',
  // Authorship / freshness signals for answer engines (dogfoods aeo's
  // author-metadata check site-wide → renders <meta name="author">).
  authors: [{ name: 'Radu Ceuca', url: GITHUB_URL }],
  creator: 'Radu Ceuca',
  publisher: 'VibeCheck',
  openGraph: {
    type: 'website',
    siteName: 'VibeCheck',
    url: SITE_URL,
    title: 'VibeCheck — your agent shipped it, this caught what it broke',
    description:
      'A quiet performance instrument for the AI-built frontend — it catches what your coding agent broke and hands the evidence straight to it.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VibeCheck — your agent shipped it, this caught what it broke',
    description:
      'A quiet performance instrument for the AI-built frontend — it catches what your coding agent broke and hands the evidence straight to it.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en" suppressHydrationWarning>
    <body
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        margin: 0,
      }}
    >
      <RootProvider search={{ enabled: false }}>{children}</RootProvider>
    </body>
  </html>
)

export default RootLayout
