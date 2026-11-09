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
import { PhaseLine } from '@/components/landing/PhaseLine'
import { YourCallCard } from '@/components/landing/YourCallCard'
import { InstallSteps } from '@/components/landing/InstallSteps'
import { LandingFaq } from '@/components/landing/LandingFaq'
import { RunRecording } from '@/components/landing/RunRecording'
import { RunTranscript } from '@/components/landing/RunTranscript'
import { StepHead } from '@/components/landing/StepHead'
import { LANDING_COPY } from '@/lib/landingCopy'
import { MCP_PACKAGE_VERSION } from '@wcgw/vibe-check-core'

const LANDING_DESCRIPTION = LANDING_COPY.metaDescription

const DATE_PUBLISHED = '2025-11-01'
const DATE_MODIFIED = '2026-10-26'
const AUTHOR_FRAGMENT = 'radu'

export const metadata: Metadata = {
  // absolute — avoid the root `%s · VibeCheck` template making the title too long
  title: { absolute: 'VibeCheck — performance and SEO overlay for AI-built apps' },
  description: LANDING_DESCRIPTION,
  openGraph: {
    title: 'Your agent built it. You decide if it ships.',
    description: LANDING_DESCRIPTION,
  },
  twitter: {
    title: 'Your agent built it. You decide if it ships.',
    description: LANDING_DESCRIPTION,
  },
  alternates: { canonical: '/', types: { 'text/markdown': '/index.md' } },
}

const AUTHOR_ID = `${SITE_URL}#${AUTHOR_FRAGMENT}`
const ORG_ID = `${SITE_URL}#org`

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}#app`,
      name: SITE_NAME,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Linux, Windows (Node.js 20+)',
      softwareVersion: MCP_PACKAGE_VERSION,
      url: SITE_URL,
      downloadUrl: 'https://www.npmjs.com/package/@wcgw/vibe-check',
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
      '@type': 'WebPage',
      '@id': `${SITE_URL}/#webpage`,
      url: SITE_URL,
      name: 'VibeCheck — performance and SEO overlay for AI-built apps',
      description: LANDING_DESCRIPTION,
      dateModified: DATE_MODIFIED,
      author: { '@id': AUTHOR_ID },
      isPartOf: { '@id': `${SITE_URL}#website` },
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

          <section id="decide" className="vc-section" aria-labelledby="decide-heading">
            <StepHead
              id="decide-heading"
              title="Nothing reaches your agent until you send it."
              lede="Open a problem in the panel. You'll see what was measured, why it matters, and what to do about it, with two buttons under it: Send to agent and copy."
            />
            <p className="vc-p">
              Send to agent delivers that one issue to the coding agent watching your project.
              Copy puts the same prompt on your clipboard. A copied prompt isn&apos;t a delivery,
              and VibeCheck never counts it as one.
            </p>
            <p className="vc-p">
              No agent is connected to this website, so Send to agent stays off here. In your own
              project it turns on once the hub is running and one agent session is watching.
            </p>
            <h3
              style={{
                margin: '28px 0 0',
                fontFamily: 'var(--vc-serif)',
                fontWeight: 500,
                fontSize: 22,
              }}
            >
              One agent per project
            </h3>
            <p className="vc-p" style={{ marginTop: 10 }}>
              Each project belongs to one agent session at a time. If a second session tries to
              watch it, that session is told who holds the project. It doesn&apos;t quietly take
              over.
            </p>
            <p className="vc-p">
              <Link className="vc-link" href="/docs/concepts/issue-lifecycle#delivery">
                What each delivery message means
              </Link>
            </p>
          </section>

          <section id="fix" className="vc-section" aria-labelledby="fix-heading">
            <StepHead
              id="fix-heading"
              title="Your agent gets evidence, not a hunch."
              lede="Your coding agent connects through a small MCP bridge and calls watch_for_issue for one project. Then it waits. When you press Send to agent, that call returns your issue with its evidence: which detector fired, the numbers, the element. The agent can ask get_fix_suggestions for a fix guide, edits your code, and calls resolve_issue. That call doesn't mark anything fixed. It asks the browser to check."
            />
            <RunRecording />
            <RunTranscript />
            <p className="vc-p" style={{ marginTop: 18 }}>
              <Link className="vc-link" href="/docs/reference/mcp-tools">
                All ten MCP tools
              </Link>
            </p>
          </section>

          <PhaseLine />

          <YourCallCard />

          <InstallSteps />

          <LandingFaq />
        </LiveEngineProvider>
      </AgentPickerProvider>
    </main>
  </SiteShell>
)

export default LandingPage
