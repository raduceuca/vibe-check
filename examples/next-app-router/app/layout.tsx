import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { DevVibeCheck } from './dev-vibe-check'

export const metadata: Metadata = {
  title: {
    default: 'Next.js App Router example for VibeCheck',
    template: '%s · VibeCheck example',
  },
  description:
    'A Next.js App Router page that passes four vibes and leaves one intentional Quotable miss: mcp-discovery-missing.',
  authors: [{ name: 'VibeCheck examples' }],
  alternates: { canonical: 'https://example.com/' },
  openGraph: {
    title: 'Next.js App Router example for VibeCheck',
    description:
      'A Next.js App Router page that passes four vibes and leaves one intentional Quotable miss: mcp-discovery-missing.',
    url: 'https://example.com/',
    images: [{ url: 'https://example.com/opengraph-image.png' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Next.js App Router example for VibeCheck',
    description:
      'A Next.js App Router page that passes four vibes and leaves one intentional Quotable miss: mcp-discovery-missing.',
  },
}

export const RootLayout = ({ children }: { readonly children: ReactNode }) => (
  <html lang="en">
    <body
      style={{
        margin: 0,
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
        color: '#111',
        background: '#fff',
      }}
    >
      {children}
      <DevVibeCheck />
    </body>
  </html>
)

export default RootLayout
