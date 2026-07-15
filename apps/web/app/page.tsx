import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL, SITE_NAME, GITHUB_URL } from '@/lib/site'
import { VibeWidget } from '@/components/vibe/VibeWidget'
import { WidgetLayoutSync } from '@/components/vibe/WidgetLayoutSync'
import { InstallCommand } from '@/components/landing/InstallCommand'
import { BreakThisPage } from '@/components/landing/BreakThisPage'
import { DetectorsGrid } from '@/components/landing/DetectorsGrid'
import { LiveGauges } from '@/components/landing/LiveGauges'
import { AuditThisPage } from '@/components/landing/AuditThisPage'
import { AgentRoundTrip } from '@/components/landing/AgentRoundTrip'
import { RealAgentDemo } from '@/components/landing/RealAgentDemo'
import { SectionHead } from '@/components/landing/SectionHead'
import { SiteShell } from '@/components/site/SiteShell'
import { PipelineDiagram } from '@/components/diagrams'
import {
  CropTicks,
  ProofControlStrip,
  ProofLabel,
  RegistrationConstellation,
  RegistrationTarget,
} from '@/components/brand/ProofMarks'
import { LANDING_COPY } from '@/lib/landingCopy'

// A tight landing pitch, kept ≤ 160 chars so VibeCheck's own seo audit passes
// its meta-description-too-long check on this very page. Shared with the JSON-LD
// so the prose and structured data stay in sync.
const LANDING_DESCRIPTION = LANDING_COPY.metaDescription

// Freshness signals for answer engines. Constants (not `new Date()`) so the
// statically prerendered HTML is deterministic across builds.
const DATE_PUBLISHED = '2025-11-01'
const DATE_MODIFIED = '2026-07-14'

export const metadata: Metadata = {
  title: LANDING_COPY.title,
  description: LANDING_DESCRIPTION,
  // Canonical for the landing — satisfies seo's canonical-missing check and
  // stops trailing-slash / query-param duplicates fragmenting rank. The markdown
  // alternate advertises the agent-readable view (dogfoods aeo's
  // markdown-negotiation check).
  alternates: { canonical: '/', types: { 'text/markdown': '/index.md' } },
}

// schema.org graph so answer engines (and VibeCheck's own aeo audit) can read
// the app's identity, price, authorship and freshness without scraping prose.
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

const LandingPage = () => (
  <SiteShell landing>
    {/* schema.org structured data — read by answer engines and by VibeCheck's
        own aeo audit (structured-data-missing / -invalid). */}
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    {/* The real widget, mounted live, measuring THIS page. Calm green at rest. */}
    <VibeWidget position="bottom-right" />
    {/* Reflects the widget's expanded/collapsed state onto :root so the layout
        shifts left (readable) while the panel is open, and re-centers when it's
        collapsed or off. */}
    <WidgetLayoutSync />

    <main className="vc-wrap">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header className="vc-hero">
        <div className="vc-proof-header" aria-label="Print control proof 01">
          <CropTicks className="vc-proof-header-crop" />
          <ProofControlStrip className="vc-proof-control-strip" />
          <ProofLabel className="vc-proof-header-label">PROOF 01</ProofLabel>
          <span className="vc-proof-header-rule" aria-hidden="true" />
          <RegistrationTarget className="vc-proof-header-target" />
        </div>

        <div className="vc-eyebrow">
          <span>{LANDING_COPY.hero.eyebrow[0]}</span>
          <span className="vc-dot" />
          <span>{LANDING_COPY.hero.eyebrow[1]}</span>
          <span className="vc-dot" />
          <span>{LANDING_COPY.hero.eyebrow[2]}</span>
        </div>

        <RegistrationConstellation className="vc-registration-constellation" />

        <h1 className="vc-hero-head">
          <span className="vc-hero-line">{LANDING_COPY.hero.headline[0]}</span>
          <span className="vc-hero-line">{LANDING_COPY.hero.headline[1]}</span>
        </h1>

        <p className="vc-lede">{LANDING_COPY.hero.lede}</p>

        <div style={{ marginTop: 22 }}>
          <InstallCommand command="npm i @wcgw/vibe-check" />
        </div>
        <p
          className="vc-mono"
          style={{
            marginTop: 12,
            fontSize: 11.5,
            letterSpacing: '0.04em',
            color: 'var(--vc-ink-4)',
          }}
        >
          {LANDING_COPY.hero.liveNote}
        </p>
      </header>

      {/* ── 01 · The pain ────────────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead
          index="01"
          title={LANDING_COPY.sections.problem.title}
          sub={LANDING_COPY.sections.problem.sub}
        />
        <p className="vc-p">{LANDING_COPY.sections.problem.body[0]}</p>
        <p className="vc-p">{LANDING_COPY.sections.problem.body[1]}</p>
      </section>

      {/* ── 02 · Break this page ─────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead
          index="02"
          title={LANDING_COPY.sections.demo.title}
          sub={LANDING_COPY.sections.demo.sub}
        />
        <p className="vc-p">{LANDING_COPY.sections.demo.body}</p>
        <BreakThisPage />
      </section>

      {/* ── The gauges — the always-measuring layer ──────────────────────── */}
      <section className="vc-section">
        <SectionHead
          index="03"
          title={LANDING_COPY.sections.measurements.title}
          sub={LANDING_COPY.sections.measurements.sub}
        />
        <p className="vc-p">{LANDING_COPY.sections.measurements.body}</p>
        <LiveGauges />
        <p className="vc-p" style={{ marginTop: 14, color: 'var(--vc-ink-3)', fontSize: 14 }}>
          {LANDING_COPY.sections.measurements.closing}
        </p>
      </section>

      {/* ── What it catches ──────────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead
          index="04"
          title={LANDING_COPY.sections.bestiary.title}
          sub={LANDING_COPY.sections.bestiary.sub}
        />
        <p className="vc-p">{LANDING_COPY.sections.bestiary.body}</p>
        <DetectorsGrid />

        <h3 className="vc-h3">{LANDING_COPY.audit.heading}</h3>
        <p className="vc-p">
          Two specimens—<span className="vc-code">seo</span> and{' '}
          <span className="vc-code">aeo</span>—run as pass/fail press checks.
          Pull a proof of the page you are reading and see what search crawlers
          and answer engines actually receive, misses included.
        </p>
        <AuditThisPage />
        <p className="vc-p" style={{ marginTop: 14 }}>
          <Link className="vc-link" href="/scan">
            {LANDING_COPY.audit.scanLink}
          </Link>
        </p>
      </section>

      {/* ── 04 · The round-trip ──────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead
          index="05"
          title={LANDING_COPY.sections.loop.title}
          sub={LANDING_COPY.sections.loop.sub}
        />
        <p className="vc-p">{LANDING_COPY.sections.loop.body}</p>
        <PipelineDiagram />
        <p className="vc-p" style={{ marginTop: 18 }}>
          This is the actual loop running against installable package tarballs:
          the widget catches DOM bloat, one agent leases the project, and the
          issue crosses the MCP bridge only when you click send.
        </p>
        <RealAgentDemo />
        <p className="vc-p" style={{ marginTop: 22 }}>
          {LANDING_COPY.sections.loop.transition}
        </p>
        <AgentRoundTrip />
        <p className="vc-p" style={{ color: 'var(--vc-ink-3)', fontSize: 14, marginTop: 12 }}>
          Ask your agent: <span className="vc-code">What is VibeCheck detecting
          right now, and how do I fix it?</span>
        </p>
      </section>

      {/* ── 05 · Install & wire up ───────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead
          index="06"
          title={LANDING_COPY.sections.install.title}
          sub={LANDING_COPY.sections.install.sub}
        />
        <h3 className="vc-h3">{LANDING_COPY.install.firstHeading}</h3>
        <pre className="vc-pre" data-vc-proof-surface="code" data-proof-label="PLATE K">
{`import { VibeCheck } from '@wcgw/vibe-check'

{process.env.NODE_ENV !== 'production' && (
  <VibeCheck
    beaconUrl="http://127.0.0.1:4200"
    projectId="my-project"
  />
)}`}
        </pre>
        <h3 className="vc-h3">{LANDING_COPY.install.secondHeading}</h3>
        <pre className="vc-pre" data-vc-proof-surface="code" data-proof-label="PLATE C">
{`# Run once in a terminal
npx -y @wcgw/vibe-check-mcp@0.3.0 hub

# Register the bridge with your agent
claude mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp@0.3.0 connect`}
        </pre>
        <p className="vc-p" style={{ marginTop: 8 }}>
          Nine project-scoped MCP tools, an <span className="vc-code">llms.txt</span>, and a
          Claude skill ship with the press check. The widget marks the defects;
          your agent gets the evidence.{' '}
          <Link className="vc-link" href="/docs/quickstart">
            {LANDING_COPY.install.quickstart}
          </Link>
        </p>
      </section>

      {/* ── Footer / CTA ─────────────────────────────────────────────────── */}
      <footer className="vc-footer" data-vc-proof-surface="footer">
        <CropTicks className="vc-footer-crop" corner="bottom-left" />
        <div>
          <b>{LANDING_COPY.footerLead}</b> Ship it.
          <br />
          Zero runtime deps in core · open source · MIT.
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          <Link href="/docs">Docs</Link>
          <Link href="/docs/quickstart">Quickstart</Link>
          <a href="https://github.com/raduceuca/vibe-check">GitHub</a>
        </div>
      </footer>
    </main>
  </SiteShell>
)

export default LandingPage
