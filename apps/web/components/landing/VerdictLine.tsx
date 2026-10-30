'use client'

import { useMemo } from 'react'
import { getSuggestion } from '@wcgw/vibe-check-core'
import { useLiveEngine } from '@/components/live/LiveEngineProvider'
import { useLiveSnapshot } from '@/components/live/useLiveSnapshot'
import {
  gradeVibes,
  overallVerdict,
  VIBES,
  type GradedVibe,
} from '@/lib/vibes'

const WORD: Record<number, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
}

const vibeName = (id: GradedVibe['id']): string =>
  VIBES.find((v) => v.id === id)?.name ?? id

const failSubline = (caught: readonly GradedVibe[]): string => {
  if (caught.length === 1) {
    const row = caught[0]
    const title = row.issues[0]
      ? getSuggestion(row.issues[0], 'vibe').title
      : 'something looks off'
    return `${vibeName(row.id)}: ${title}.`
  }
  const names = caught.map((row) => vibeName(row.id))
  const head = names.slice(0, -1).join(', ')
  const last = names[names.length - 1]
  return `${WORD[caught.length] ?? String(caught.length)} vibes caught: ${head} and ${last}.`
}

export const VerdictLine = () => {
  const snapshot = useLiveSnapshot()
  const { engine } = useLiveEngine()

  const graded = useMemo(
    () =>
      gradeVibes({
        snapshot,
        seoRun: engine?.getAuditRun?.('seo') ?? null,
        aeoRun: engine?.getAuditRun?.('aeo') ?? null,
      }),
    [snapshot, engine],
  )

  const verdict = overallVerdict(graded)
  const caught = graded.filter((row) => row.state === 'caught')

  let headline = 'Checking this page…'
  let sub = 'Reading frames, requests, the console and both audits.'
  let state: 'checking' | 'pass' | 'fail' | 'incomplete' = 'checking'

  if (verdict === 'pass') {
    headline = 'This page passes the vibe check.'
    sub = 'Five of five. Now try to break it.'
    state = 'pass'
  } else if (verdict === 'fail') {
    headline = "This page doesn't pass the vibe check."
    sub = failSubline(caught)
    state = 'fail'
  } else if (verdict === 'incomplete') {
    headline = "This page couldn't finish its check."
    sub = 'An audit did not finish. That is not a pass.'
    state = 'incomplete'
  }

  return (
    <div className="vc-verdict" style={{ minHeight: '4.5rem', marginBottom: 28 }}>
      <p
        role="status"
        aria-live="polite"
        data-vc-verdict={state}
        style={{
          margin: 0,
          fontFamily: 'var(--vc-serif)',
          fontWeight: 500,
          fontSize: 'clamp(28px, 24px + 1vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.015em',
          color: 'var(--vc-ink)',
        }}
      >
        {headline}
      </p>
      <p
        style={{
          margin: '8px 0 0',
          fontSize: 16,
          color: 'var(--vc-ink-2)',
          lineHeight: 1.45,
        }}
      >
        {sub}
      </p>
    </div>
  )
}
