'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { getSuggestion } from '@wcgw/vibe-check-core'
import { useLiveEngine } from '@/components/live/LiveEngineProvider'
import { useLiveSnapshot } from '@/components/live/useLiveSnapshot'
import { CopyButton } from './CopyButton'
import { StepHead } from './StepHead'
import { LANDING_COPY } from '@/lib/landingCopy'
import {
  gradeVibes,
  overallVerdict,
  VIBES,
  type GradedVibe,
} from '@/lib/vibes'

const vibeName = (id: GradedVibe['id']): string =>
  VIBES.find((v) => v.id === id)?.name ?? id

const stateWord = (row: GradedVibe): string => {
  if (row.state === 'measuring') return 'Measuring…'
  if (row.state === 'passing' || row.state === 'passing-again') return 'Passing'
  if (row.state === 'incomplete') return "Couldn't finish"
  if (row.state === 'rechecking') return 'Re-checking'
  if (row.issues[0]) return `Caught: ${getSuggestion(row.issues[0], 'vibe').title}`
  return 'Caught'
}

const summaryFor = (graded: readonly GradedVibe[]): string => {
  const verdict = overallVerdict(graded)
  if (verdict === 'checking') return 'The SEO and AEO audits are still running.'
  if (verdict === 'incomplete') {
    const row = graded.find((g) => g.state === 'incomplete')
    return row
      ? `${vibeName(row.id)} couldn't finish. That isn't a pass.`
      : "This page couldn't finish its check."
  }
  const caught = graded.filter((g) => g.state === 'caught' || g.state === 'rechecking')
  if (caught.length > 0) {
    const row = caught[0]
    const title = row.issues[0]
      ? getSuggestion(row.issues[0], 'vibe').title
      : 'something looks off'
    return `${vibeName(row.id)} is still caught: ${title}. Put it back, or leave it. It's your call.`
  }
  return "You didn't break anything. The page passed all five on its own. That's the job."
}

export const YourCallCard = () => {
  const snapshot = useLiveSnapshot()
  const { engine } = useLiveEngine()
  const [clock, setClock] = useState('--:--')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(
        `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      )
    }
    tick()
    const id = window.setInterval(tick, 30_000)
    return () => window.clearInterval(id)
  }, [])

  const graded = useMemo(
    () =>
      gradeVibes({
        snapshot,
        seoRun: engine?.getAuditRun?.('seo') ?? null,
        aeoRun: engine?.getAuditRun?.('aeo') ?? null,
      }),
    [snapshot, engine],
  )

  const summary = summaryFor(graded)
  const plain = [
    `This page · vibecheck.wcgw.fun · ${clock}`,
    ...graded.map((row) => `${vibeName(row.id)}: ${stateWord(row)} (${row.reading})`),
    summary,
  ].join('\n')

  return (
    <section id="your-call" className="vc-section" aria-labelledby="your-call-heading">
      <StepHead
        id="your-call-heading"
        title={LANDING_COPY.yourCall.title}
        lede={LANDING_COPY.yourCall.body}
      />

      <div
        style={{
          border: '1px solid var(--vc-line)',
          borderRadius: 12,
          padding: 20,
          background: '#fff',
        }}
      >
        <p
          style={{
            margin: '0 0 16px',
            fontSize: 14,
            color: 'var(--vc-ink-3)',
            fontVariantNumeric: 'tabular-nums',
            minHeight: '1.2em',
          }}
        >
          This page · vibecheck.wcgw.fun · {clock}
        </p>

        <div style={{ display: 'grid', gap: 12 }}>
          {graded.map((row) => (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '7rem 1fr',
                gap: 12,
                alignItems: 'baseline',
                borderTop: '1px solid var(--vc-line-2, var(--vc-line))',
                paddingTop: 12,
              }}
            >
              <span style={{ fontFamily: 'var(--vc-serif)', fontWeight: 500, fontSize: 18 }}>
                {vibeName(row.id)}
              </span>
              <span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{stateWord(row)}</span>
                <span
                  className="vc-mono"
                  style={{ display: 'block', marginTop: 4, fontSize: 13, color: 'var(--vc-ink-2)' }}
                >
                  {row.reading}
                </span>
              </span>
            </div>
          ))}
        </div>

        <p
          style={{
            margin: '20px 0 0',
            fontFamily: 'var(--vc-serif)',
            fontWeight: 400,
            fontSize: 'clamp(20px, 18px + 0.5vw, 26px)',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
          }}
        >
          {summary}
        </p>

        <div
          style={{
            marginTop: 18,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <CopyButton text={plain} label={LANDING_COPY.yourCall.copySummary} />
          <Link className="vc-link" href="#install" style={{ fontSize: 15 }}>
            {LANDING_COPY.yourCall.runOwn}
          </Link>
        </div>
      </div>
    </section>
  )
}
