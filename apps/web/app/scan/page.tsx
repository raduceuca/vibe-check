import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site/SiteHeader'
import { ScanForm } from '@/components/scan/ScanForm'
import { ScanBoards } from '@/components/scan/ScanBoards'
import { absoluteUrl } from '@/lib/site'

// The public scanner: paste a URL, get the same SEO + AEO scorecard VibeCheck
// runs on itself, with a fix guide behind every miss. Interactive, so it's
// deliberately excluded from the markdown (.md) route — no `text/markdown`
// alternate is advertised.

const TITLE = 'Scan your site — free SEO & AEO scorecard'
const DESCRIPTION =
  'Can the answer engines read your site? Paste a URL for a free scorecard — the same 19 SEO + 9 AEO checks VibeCheck runs, with a fix for every miss.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/scan' },
  openGraph: {
    title: `${TITLE} · VibeCheck`,
    description: DESCRIPTION,
    url: absoluteUrl('/scan'),
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${TITLE} · VibeCheck`,
    description: DESCRIPTION,
  },
}

const ScanPage = () => (
  <div className="vc-landing">
    <SiteHeader active="/scan" />
    <main className="vc-wrap">
      <header className="vc-scan-hero">
        <div className="vc-eyebrow">
          <span>VibeCheck</span>
          <span className="vc-dot" />
          <span>SEO / AEO scanner</span>
        </div>
        <h1 className="vc-hero-head">
          Can the answer engines{' '}
          <span className="vc-hero-sig">read your site?</span>
        </h1>
        <p className="vc-lede">
          Most sites are half-broken for Google and invisible to ChatGPT and
          Perplexity. Paste a URL — we run the same <b>19 SEO + 9 AEO</b> checks
          the widget ships, and hand you a fix for every miss. No install.
        </p>
      </header>

      <ScanForm />
      <ScanBoards />
    </main>
  </div>
)

export default ScanPage
