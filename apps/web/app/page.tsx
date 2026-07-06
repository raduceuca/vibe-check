import Link from 'next/link'
import { VibeWidget } from '@/components/vibe/VibeWidget'
import { InstallCommand } from '@/components/landing/InstallCommand'
import { BreakThisPage } from '@/components/landing/BreakThisPage'
import { DetectorsGrid } from '@/components/landing/DetectorsGrid'
import { SectionHead } from '@/components/landing/SectionHead'
import { SiteHeader } from '@/components/site/SiteHeader'

const LandingPage = () => (
  <div className="vc-landing">
    <SiteHeader active="/" />
    {/* The real widget, mounted live, measuring THIS page. Calm green at rest. */}
    <VibeWidget position="bottom-right" />

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
          into your agent.
        </p>
        <DetectorsGrid />
      </section>

      {/* ── 04 · The round-trip ──────────────────────────────────────────── */}
      <section className="vc-section">
        <SectionHead num="04" title="From symptom to fix" sub="the round-trip" />
        <p className="vc-p">
          The widget captures a snapshot, beacons it to a local MCP server, and
          your agent reads it — then proposes the diff. The loop that was missing
          from vibe coding:
        </p>
        <pre className="vc-pre">
{`browser (collectors)
  → VibeCheckEngine
    → beacon  POST /api/snapshot
      → MCP server  (localhost:4200)
        → your agent reads get_detected_issues
          → proposes the fix`}
        </pre>
        <p className="vc-p" style={{ color: 'var(--vc-ink-3)', fontSize: 14 }}>
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
