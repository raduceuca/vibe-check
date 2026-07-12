'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createSeoDetector,
  createAeoDetector,
  SEO_CRITERIA_COUNT,
  AEO_CRITERIA_COUNT,
} from '@wcgw/vibe-check-core'
import type { VibeIssue, Severity } from '@wcgw/vibe-check-core'

// ── Run the real SEO / AEO audit on THIS page ────────────────────────────────
// The instrument grading its own home. On click we run VibeCheck's actual
// createSeoDetector + createAeoDetector against the live document and render the
// honest result — the score out of SEO_CRITERIA_COUNT / AEO_CRITERIA_COUNT and a
// pass/fail checklist. Failures are the detector's REAL findings (their titles),
// so a missing canonical or absent JSON-LD shows up here, not a faked 100%.

// Each criterion maps to the check id(s) the detector emits when it FAILS. The
// detector surfaces only failures, so a criterion passes when none of its ids
// appear in the issue list. Ids and order mirror detectors/seo.ts + aeo.ts, so
// (total − issues.length) — the detector's own scoring — reconciles exactly.
interface Criterion {
  readonly checks: readonly string[]
  readonly label: string
}

const SEO_CRITERIA: readonly Criterion[] = [
  { checks: ['title-missing'], label: 'Page has a <title>' },
  { checks: ['title-too-long'], label: 'Title fits in ~60 characters' },
  { checks: ['title-default'], label: 'Title is not a framework placeholder' },
  { checks: ['title-too-short'], label: 'Title is descriptive (10+ chars)' },
  { checks: ['meta-description-missing'], label: 'Has a meta description' },
  { checks: ['meta-description-too-long'], label: 'Meta description within ~160 chars' },
  { checks: ['og-image-missing'], label: 'Has an og:image social preview' },
  { checks: ['og-title-missing'], label: 'Has an og:title' },
  { checks: ['og-description-missing'], label: 'Has an og:description' },
  { checks: ['og-url-missing'], label: 'Has an og:url' },
  { checks: ['twitter-card-missing'], label: 'Has a Twitter / X card' },
  { checks: ['canonical-missing'], label: 'Declares a canonical URL' },
  { checks: ['h1-missing', 'h1-multiple'], label: 'Has exactly one <h1>' },
  { checks: ['image-alt-missing'], label: 'All images have alt text' },
  { checks: ['generic-link-text'], label: 'Link text is descriptive' },
  { checks: ['slug-unfriendly'], label: 'URL slug is clean' },
  { checks: ['noindex'], label: 'Page is indexable (no noindex)' },
  { checks: ['sitemap-missing'], label: 'Serves a valid sitemap.xml' },
  { checks: ['robots-missing'], label: 'Serves a robots.txt' },
]

const AEO_CRITERIA: readonly Criterion[] = [
  { checks: ['structured-data-missing'], label: 'Ships structured data (JSON-LD)' },
  { checks: ['structured-data-invalid'], label: 'Structured data is valid schema.org' },
  { checks: ['no-main-landmark'], label: 'Has a <main> landmark' },
  { checks: ['no-author-metadata'], label: 'Exposes author / date signals' },
  { checks: ['llms-txt-missing'], label: 'Serves an llms.txt' },
  { checks: ['content-requires-js'], label: 'Content renders without JavaScript' },
  { checks: ['markdown-negotiation-missing'], label: 'Offers markdown content negotiation' },
  { checks: ['ai-crawlers-blocked'], label: 'Allows AI crawlers in robots.txt' },
  { checks: ['mcp-discovery-missing'], label: 'Advertises an MCP interface' },
]

interface CheckRow {
  readonly pass: boolean
  readonly label: string
  readonly severity?: Severity
}

interface AuditResult {
  readonly passed: number
  readonly total: number
  readonly rows: readonly CheckRow[]
}

const checkId = (issue: VibeIssue): string | null => {
  const value = issue.evidence['check']
  return typeof value === 'string' ? value : null
}

// Fails first (they are the point), most severe first; passes keep catalog order.
const SEV_RANK: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 }
const sortRows = (rows: readonly CheckRow[]): readonly CheckRow[] =>
  [...rows].sort((a, b) => {
    if (a.pass !== b.pass) return a.pass ? 1 : -1
    if (!a.pass && !b.pass) return SEV_RANK[a.severity ?? 'info'] - SEV_RANK[b.severity ?? 'info']
    return 0
  })

const buildResult = (
  criteria: readonly Criterion[],
  total: number,
  issues: readonly VibeIssue[],
): AuditResult => {
  const byCheck = new Map<string, VibeIssue>()
  for (const issue of issues) {
    const id = checkId(issue)
    if (id !== null) byCheck.set(id, issue)
  }
  const owned = new Set(criteria.flatMap((c) => c.checks))
  const catalogRows: CheckRow[] = criteria.map((c) => {
    const fail = c.checks.map((id) => byCheck.get(id)).find((x): x is VibeIssue => Boolean(x))
    return fail
      ? { pass: false, label: fail.title, severity: fail.severity }
      : { pass: true, label: c.label }
  })
  // Safety net: never hide a real failure the catalog didn't anticipate.
  const extraRows: CheckRow[] = issues
    .filter((issue) => {
      const id = checkId(issue)
      return id === null || !owned.has(id)
    })
    .map((issue) => ({ pass: false, label: issue.title, severity: issue.severity }))
  return {
    total,
    passed: Math.max(0, total - issues.length),
    rows: sortRows([...catalogRows, ...extraRows]),
  }
}

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms))

type Phase = 'idle' | 'running' | 'done'

const AuditColumn = ({ name, sub, result }: { name: string; sub: string; result: AuditResult }) => {
  const pct = result.total > 0 ? (result.passed / result.total) * 100 : 0
  return (
    <div className="vc-audit-col">
      <div className="vc-audit-head">
        <span className="vc-audit-name">{name}</span>
        <span className="vc-audit-sub">{sub}</span>
      </div>
      <div className="vc-audit-score">
        <span className="vc-audit-score-num">{result.passed}</span>
        <span className="vc-audit-score-tot">/ {result.total} passed</span>
      </div>
      <div className="vc-audit-bar">
        <span className="vc-audit-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <ul className="vc-checks">
        {result.rows.map((row, i) => (
          <li
            className="vc-check"
            key={`${row.label}-${i}`}
            data-pass={row.pass}
            data-sev={row.severity ?? ''}
          >
            <span className="vc-check-mark" aria-hidden="true">
              {row.pass ? '✓' : '✗'}
            </span>
            <span className="vc-check-label">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Results {
  readonly seo: AuditResult
  readonly aeo: AuditResult
}

export const AuditThisPage = () => {
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<Results | null>(null)
  const token = useRef(0)

  useEffect(() => () => { token.current += 1 }, [])

  const run = useCallback(async () => {
    const myToken = (token.current += 1)
    setPhase('running')

    const seo = createSeoDetector()
    const aeo = createAeoDetector()
    seo.start()
    aeo.start()

    // Poll until the async probes (sitemap, robots, llms.txt, markdown, MCP)
    // settle: unchanged issue count for ~750ms after a 1.3s floor, 5s cap.
    const startedAt = Date.now()
    let last = -1
    let stable = 0
    while (Date.now() - startedAt < 5000) {
      await delay(250)
      if (token.current !== myToken) {
        seo.stop()
        aeo.stop()
        return
      }
      const count = seo.getIssues().length + aeo.getIssues().length
      const elapsed = Date.now() - startedAt
      if (elapsed > 1300 && count === last) {
        stable += 1
        if (stable >= 3) break
      } else {
        stable = 0
      }
      last = count
    }

    const seoIssues = seo.getIssues()
    const aeoIssues = aeo.getIssues()
    seo.stop()
    aeo.stop()
    if (token.current !== myToken) return

    setResults({
      seo: buildResult(SEO_CRITERIA, SEO_CRITERIA_COUNT, seoIssues),
      aeo: buildResult(AEO_CRITERIA, AEO_CRITERIA_COUNT, aeoIssues),
    })
    setPhase('done')
  }, [])

  return (
    <div>
      <button
        type="button"
        className="vc-audit-run"
        onClick={run}
        disabled={phase === 'running'}
        data-running={phase === 'running'}
      >
        <span className="vc-audit-run-dot" />
        {phase === 'idle'
          ? 'Run the SEO / AEO audit on this page'
          : phase === 'running'
            ? 'Auditing this page…'
            : 'Run the audit again'}
      </button>

      {phase === 'running' && !results ? (
        <div className="vc-audit-status">
          Running the real detectors against this document — probing head tags,
          sitemap, robots, llms.txt, markdown negotiation and MCP discovery…
        </div>
      ) : null}

      {results ? (
        <>
          <div className="vc-audit-cols">
            <AuditColumn name="SEO" sub="search visibility" result={results.seo} />
            <AuditColumn name="AEO" sub="answer-engine readiness" result={results.aeo} />
          </div>
          <p className="vc-audit-note">
            These are the same detectors the widget ships — run live against this
            exact page. The misses are real: this is the instrument grading its own
            home, not a staged 100%. Fix them and the score climbs.
          </p>
        </>
      ) : null}
    </div>
  )
}
