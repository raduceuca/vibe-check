'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import type { ScanCheck, ScanCategoryResult, ScanResult, Severity } from '@/lib/scan/types'

// ── /scan form + scorecard ───────────────────────────────────────────────────
// Client half of the scan page: a URL field + dark Scan button, then the SEO /
// AEO score columns rendered in the exact Quiet-Instrument treatment of the
// landing AuditThisPage (two columns, fill bars, ✓/✗ checklist). Every ✗ links
// to its /fix guide. Fails sort first, most-severe first — the misses are the
// point.

type Phase = 'idle' | 'running' | 'done' | 'error'

const SEV_RANK: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 }

const sortRows = (rows: readonly ScanCheck[]): readonly ScanCheck[] =>
  [...rows].sort((a, b) => {
    if (a.pass !== b.pass) return a.pass ? 1 : -1
    if (!a.pass && !b.pass) return SEV_RANK[a.severity] - SEV_RANK[b.severity]
    return 0
  })

const ScanColumn = ({
  name,
  sub,
  result,
}: {
  name: string
  sub: string
  result: ScanCategoryResult
}) => {
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
        {sortRows(result.checks).map((row, i) => (
          <li className="vc-check" key={`${row.id}-${i}`} data-pass={row.pass} data-sev={row.severity}>
            <span className="vc-check-mark" aria-hidden="true">
              {row.pass ? '✓' : '✗'}
            </span>
            <span className="vc-check-label">
              {row.label}
              {!row.pass && row.detail ? <span className="vc-check-detail"> — {row.detail}</span> : null}
            </span>
            {row.fixHref ? (
              <Link className="vc-check-fix" href={row.fixHref} data-pass={row.pass}>
                {row.pass ? 'guide →' : 'how to fix →'}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

export const ScanForm = () => {
  const [url, setUrl] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Shared runner for both the form submit and the ?url= auto-run.
  const execute = useCallback(async (raw: string) => {
    const value = raw.trim()
    if (value.length === 0) return

    setUrl(value)
    setPhase('running')
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: value }),
      })
      const data: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof data === 'object' && data !== null && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Something went wrong. Try another URL.'
        setError(message)
        setPhase('error')
        return
      }
      setResult(data as ScanResult)
      setPhase('done')
      // Tell the boards a scan was just recorded so they refresh in place.
      window.dispatchEvent(new Event('vc-scan-recorded'))
    } catch {
      setError("Couldn't reach the scanner. Check your connection and try again.")
      setPhase('error')
    }
  }, [])

  const onSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (phase === 'running') return
      void execute(url)
    },
    [execute, url, phase],
  )

  // Prefill (and auto-run once) from ?url=, so the board's "rescan" links land
  // on a live result. Read from location directly — no Suspense boundary needed.
  const didAutoRun = useRef(false)
  useEffect(() => {
    if (didAutoRun.current) return
    didAutoRun.current = true
    const param = new URLSearchParams(window.location.search).get('url')
    if (param && param.trim().length > 0) void execute(param)
  }, [execute])

  return (
    <div className="vc-scan">
      <form className="vc-scan-form" onSubmit={onSubmit}>
        <input
          className="vc-scan-input"
          type="text"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="yoursite.com"
          aria-label="Website URL to scan"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="vc-btn" type="submit" disabled={phase === 'running'} data-running={phase === 'running'}>
          <span className="vc-btn-dot" />
          {phase === 'running' ? 'Scanning…' : 'Scan'}
        </button>
      </form>

      {phase === 'running' ? (
        <div className="vc-audit-status">
          <span className="vc-audit-run-dot" style={{ borderRadius: '50%', background: 'var(--vc-amber)' }} />
          Fetching the served HTML and probing sitemap, robots, llms.txt, markdown negotiation and MCP discovery…
        </div>
      ) : null}

      {phase === 'error' && error ? (
        <div className="vc-scan-error" role="alert">
          <span className="vc-scan-error-mark" aria-hidden="true">
            ✗
          </span>
          <span>{error}</span>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="vc-scan-meta">
            Scanned <span className="vc-code">{result.url}</span>
          </div>
          <div className="vc-audit-cols">
            <ScanColumn name="SEO" sub="search visibility" result={result.seo} />
            <ScanColumn name="AEO" sub="answer-engine readiness" result={result.aeo} />
          </div>
          <p className="vc-audit-note">
            SEO / AEO reflect the served HTML. Live performance — FPS, long tasks, memory — requires the{' '}
            <Link className="vc-link" href="/docs/quickstart">
              widget installed on your site
            </Link>
            .
          </p>
        </>
      ) : null}
    </div>
  )
}
