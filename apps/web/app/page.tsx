import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL, SITE_NAME, GITHUB_URL } from '@/lib/site'
import { VibeWidget } from '@/components/vibe/VibeWidget'
import { WidgetLayoutSync } from '@/components/vibe/WidgetLayoutSync'
import { InstallCommand } from '@/components/landing/InstallCommand'
import { BreakThisPage } from '@/components/landing/BreakThisPage'
import { DetectorsGrid } from '@/components/landing/DetectorsGrid'
import { AuditThisPage } from '@/components/landing/AuditThisPage'
import { AgentRoundTrip } from '@/components/landing/AgentRoundTrip'
import { SectionHead } from '@/components/landing/SectionHead'
import { SiteHeader } from '@/components/site/SiteHeader'
import { PipelineDiagram } from '@/components/diagrams'

// A tight landing pitch, kept ≤ 160 chars so VibeCheck's own seo audit passes
// its meta-description-too-long check on this very page. Shared with the JSON-LD
// so the prose and structured data stay in sync.
const LANDING_DESCRIPTION =
  'A quiet performance instrument for the AI-built frontend. It catches jank, leaks, DOM bloat and layout shift, then hands the evidence to your coding agent.'

// Freshness signals for answer engines. Constants (not `new Date()`) so the
// statically prerendered HTML is deterministic across builds.
const DATE_PUBLISHED = '2025-11-01'
const DATE_MODIFIED = '2026-07-06'

export const metadata: Metadata = {
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
  <div className="vc-landing">
    {/* schema.org structured data — read by answer engines and by VibeCheck's
        own aeo audit (structured-data-missing / -invalid). */}
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
    <SiteHeader active="/" />
    {/* The real widget, mounted live, measuring THIS page. Calm green at rest. */}
    <VibeWidget position="bottom-right" />
    {/* Reflects the widget's expanded/collapsed state onto :root so the layout
        shifts left (readable) while the panel is open, and re-centers when it's
        collapsed or off. */}
    <WidgetLayoutSync />

    <main className="vc-wrap">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <header>
        <div className="vc-eyebrow">
          <span>VibeCheck</span>
          <span className="vc-dot" />
          <span>performance instrument</span>
          <span className="vc-dot" />
          <span>for the AI-built frontend</span>
        </div>

        <h1 className="vc-hero-head">
          Your agent shipped it.{' '}
          <span className="vc-hero-sig">This caught what it broke.</span>
        </h1>

        <p className="vc-lede">
          A quiet performance instrument for the AI-built frontend. It runs in
          the corner, watches for <b>jank</b>, <b>leaks</b>, <b>DOM bloat</b>,{' '}
          <b>layout shift</b> and failing audits — and hands the evidence
          straight to your coding agent.
        </p>

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
          The widget in the bottom-right corner is live — it is measuring this
          page right now.
        </p>
      </header>

      {/* ── 01 · The pain ────────────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead num="01" title="The pain, named in one breath" sub="your Tuesday" />
        <p className="vc-p">
          AI agents ship frontends that pass review and look fine in the happy
          path — then <b>leak memory</b> across route changes, <b>bloat the DOM</b>{' '}
          to 10k nodes, fire the <b>same request eight times</b>, jank on scroll,{' '}
          <b>shift layout</b> as things load, and quietly fail Core Web Vitals and
          SEO. Nobody is watching, because the person who &ldquo;wrote&rdquo; it
          was an agent and the human never opened DevTools.
        </p>
        <p className="vc-p">
          <b>VibeCheck is the observer that was missing</b> — a performance
          conscience for your coding agent. It watches what the agent builds, and
          when something is wrong it doesn&rsquo;t just nag you: it tells the
          agent, in the agent&rsquo;s own language (MCP), with the exact evidence.
        </p>
      </section>

      {/* ── 02 · Break this page ─────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead num="02" title="Break this page" sub="the live proof" />
        <p className="vc-p">
          These are not mockups. Each button induces a <b>real</b> fault in this
          page; the instrument in the corner catches it in real time. When
          you&rsquo;re done, reset it — nobody is left on a degraded page.
        </p>
        <BreakThisPage />
      </section>

      {/* ── 03 · What it catches ─────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead num="03" title="What it catches" sub="13 dial faces" />
        <p className="vc-p">
          A restrained set of detectors and audits. One line each, plus the kind
          of issue string it emits into the widget&rsquo;s Problems list — and
          into your agent. Hover or tab through a card to watch it fire.
        </p>
        <DetectorsGrid />

        <h3 className="vc-h3">Grade this very page</h3>
        <p className="vc-p">
          Two of those detectors — <span className="vc-code">seo</span> and{' '}
          <span className="vc-code">aeo</span> — run as pass/fail audits. Point
          them at the page you&rsquo;re on and see the honest score, misses and
          all:
        </p>
        <AuditThisPage />
      </section>

      {/* ── 04 · The round-trip ──────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead num="04" title="From symptom to fix" sub="the round-trip" />
        <p className="vc-p">
          The widget captures a snapshot, beacons it to a local MCP server, and
          your agent reads it — then proposes the diff. The loop that was missing
          from vibe coding:
        </p>
        <PipelineDiagram />
        <p className="vc-p" style={{ marginTop: 18 }}>
          Here is that loop as your agent sees it — a caught issue read over MCP,
          a proposed diff, and the issue resolved. Play it:
        </p>
        <AgentRoundTrip />
        <p className="vc-p" style={{ color: 'var(--vc-ink-3)', fontSize: 14, marginTop: 12 }}>
          Ask your agent: <span className="vc-code">What is VibeCheck detecting
          right now, and how do I fix it?</span>
        </p>
      </section>

      {/* ── 05 · Install & wire up ───────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead num="05" title="Install & wire up your agent" sub="two blocks" />
        <h3 className="vc-h3">Drop in the widget</h3>
        <pre className="vc-pre">
{`import { VibeCheck } from '@wcgw/vibe-check'

{process.env.NODE_ENV !== 'production' && <VibeCheck />}`}
        </pre>
        <h3 className="vc-h3">Connect your coding agent</h3>
        <pre className="vc-pre">
{`claude mcp add vibe-check -- npx -y @wcgw/vibe-check-mcp`}
        </pre>
        <p className="vc-p" style={{ marginTop: 8 }}>
          Six MCP tools, an <span className="vc-code">llms.txt</span>, and a
          Claude skill ship in the box.{' '}
          <Link className="vc-link" href="/docs/quickstart">
            Read the 5-minute quickstart →
          </Link>
        </p>
      </section>

      {/* ── Footer / CTA ─────────────────────────────────────────────────── */}
      <footer className="vc-footer">
        <div>
          <b>It&rsquo;s already running in the corner.</b> Ship it.
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
  </div>
)

export default LandingPage
