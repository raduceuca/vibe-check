import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site/SiteHeader'
import { ScanForm } from '@/components/scan/ScanForm'
import { absoluteUrl } from '@/lib/site'

// The public scanner: paste a URL, get the same SEO + AEO scorecard VibeCheck
// runs on itself, with a fix guide behind every miss. Interactive, so it's
// deliberately excluded from the markdown (.md) route — no `text/markdown`
// alternate is advertised.

const TITLE = 'Scan your site — SEO & AEO scorecard'
const DESCRIPTION =
  'Score your site the way VibeCheck does — paste a URL and run the same SEO and answer-engine (AEO) checks, with a fix guide for every miss.'

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
          Score your site{' '}
          <span className="vc-hero-sig">the way VibeCheck does.</span>
        </h1>
        <p className="vc-lede">
          Paste a URL. We fetch the served HTML and run the same SEO and
          answer-engine (AEO) checks the widget ships — then link every miss to
          its fix guide.
        </p>
      </header>

      <ScanForm />
    </main>
  </div>
)

export default ScanPage
