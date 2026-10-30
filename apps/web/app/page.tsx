import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL, SITE_NAME, GITHUB_URL } from '@/lib/site'
import { SiteShell } from '@/components/site/SiteShell'
import { LiveEngineProvider } from '@/components/live/LiveEngineProvider'
import { AgentPickerProvider } from '@/components/landing/AgentPicker'
import { HeroSetupLine } from '@/components/landing/HeroSetupLine'
import { HeroNote } from '@/components/landing/HeroNote'
import { LiveLine } from '@/components/landing/LiveLine'
import { VibeLedger } from '@/components/landing/VibeLedger'
import { LoopSteps } from '@/components/landing/LoopSteps'
import { FaultBench } from '@/components/landing/FaultBench'
import { StepHead } from '@/components/landing/StepHead'
import { LANDING_COPY } from '@/lib/landingCopy'

const LANDING_DESCRIPTION = LANDING_COPY.metaDescription

const DATE_PUBLISHED = '2025-11-01'
const DATE_MODIFIED = '2026-10-30'

export const metadata: Metadata = {
  title: LANDING_COPY.title,
  description: LANDING_DESCRIPTION,
  alternates: { canonical: '/', types: { 'text/markdown': '/index.md' } },
}

const AUTHOR_ID = `${GITHUB_URL}#author`
const ORG_ID = `${SITE_URL}#org`

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}#app`,
      name: SITE_NAME,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      url: SITE_URL,
      description: LANDING_DESCRIPTION,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      isAccessibleForFree: true,
      license: 'https://opensource.org/licenses/MIT',
      author: { '@id': AUTHOR_ID },
      creator: { '@id': AUTHOR_ID },
      publisher: { '@id': ORG_ID },
      datePublished: DATE_PUBLISHED,
      dateModified: DATE_MODIFIED,
      sameAs: [GITHUB_URL],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: LANDING_DESCRIPTION,
      publisher: { '@id': ORG_ID },
    },
    {
      '@type': 'Person',
      '@id': AUTHOR_ID,
      name: 'Radu Ceuca',
      url: GITHUB_URL,
    },
    {
      '@type': 'Organization',
      '@id': ORG_ID,
      name: SITE_NAME,
      url: SITE_URL,
      sameAs: [GITHUB_URL],
    },
  ],
}

/** Pre-paint CLS guard: returning visitors who collapsed the widget keep the centred column. */
const widgetCollapseScript = `(function(){try{var r=localStorage.getItem('vibecheck-site');if(!r)return;var p=JSON.parse(r);if(p&&p.collapsed===true)document.documentElement.dataset.vcWidget='collapsed';}catch(e){}})();`

const LandingPage = () => (
  <SiteShell landing footer variant="topbar">
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: widgetCollapseScript }}
    />
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />

    <main id="main" className="vc-wrap">
      <AgentPickerProvider>
        <LiveEngineProvider>
          <section id="top" className="vc-hero" aria-labelledby="hero-heading">
            <p
              className="vc-kicker"
              style={{
                margin: '0 0 18px',
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--vc-ink-3)',
              }}
            >
              {LANDING_COPY.hero.kicker}
            </p>

            <h1 id="hero-heading" className="vc-hero-head">
              <span className="vc-line">{LANDING_COPY.hero.headline[0]}</span>{' '}
              <span className="vc-line">{LANDING_COPY.hero.headline[1]}</span>
            </h1>

            <p className="vc-lede">{LANDING_COPY.hero.lede}</p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 16,
                alignItems: 'center',
                marginTop: 22,
              }}
            >
              <Link href="#install" className="vc-btn vc-btn-outline">
                {LANDING_COPY.hero.primaryCta}
              </Link>
              <Link href="#notice" className="vc-link" style={{ fontSize: 15 }}>
                {LANDING_COPY.hero.secondaryCta}{' '}
                <span aria-hidden>↓</span>
              </Link>
            </div>

            <HeroSetupLine />
            <LiveLine />
            <HeroNote />
          </section>

          <VibeLedger />

          <LoopSteps />

          <FaultBench />

          <section id="install" className="vc-section" aria-labelledby="install-heading">
            <StepHead id="install-heading" title={LANDING_COPY.install.title} />
            <HeroSetupLine />
            <p className="vc-p" style={{ marginTop: 18 }}>
              Full install steps, agent config, and the dogfood demo ship with the rest of the
              rebuild.{' '}
              <Link className="vc-link" href="/docs/quickstart">
                Read the quickstart
              </Link>
              .
            </p>
          </section>
        </LiveEngineProvider>
      </AgentPickerProvider>
    </main>
  </SiteShell>
)

export default LandingPage
