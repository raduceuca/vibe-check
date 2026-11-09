'use client'

import { useMemo } from 'react'
import { getAgentPrompt, getSuggestion } from '@wcgw/vibe-check-core'
import { useLiveEngine } from '@/components/live/LiveEngineProvider'
import { useLiveSnapshot } from '@/components/live/useLiveSnapshot'
import { CopyButton } from './CopyButton'
import { gradeVibes, VIBES, type VibeId, type VibeRowState } from '@/lib/vibes'

const STATE_LABEL: Record<VibeRowState, string> = {
  measuring: 'Measuring…',
  passing: 'Passing',
  caught: 'Caught',
  rechecking: 'Re-checking',
  'passing-again': 'Passing again',
  incomplete: "Couldn't finish",
}

const CHECKS: Record<VibeId, readonly string[]> = {
  smooth: [
    'Layout shift clusters: three or more unexpected shifts within half a second.',
    'Long-frame scripts: one script behind more than three long animation frames. Chrome and Edge.',
    'Also read live: frame rate, long frames, CLS and INP.',
  ],
  light: [
    'DOM size: a warning at 800 elements, a failure at 1,500.',
    'Repeated requests: the same method and URL twice within two seconds.',
    'Memory growth: heap up 10% (warning) or 25% (failure) over 30 seconds with no recovery. Chrome and Edge.',
    'Mis-sized images, heavy images, big files, and known heavy libraries.',
  ],
  clean: [
    'Console noise: more than 20 console messages within 10 seconds.',
    'Web essentials: a favicon, a viewport tag, a page language and a character set.',
  ],
  findable: [
    'The SEO audit: title, description, social previews, canonical, headings, alt text, indexability, sitemap and robots.',
  ],
  quotable: [
    'The AEO audit: JSON-LD, main landmark, author and date, llms.txt, markdown view, AI crawlers, and an MCP card.',
  ],
}

interface LedgerRowProps {
  readonly vibeId: VibeId
}

export const LedgerRow = ({ vibeId }: LedgerRowProps) => {
  const snapshot = useLiveSnapshot()
  const { engine } = useLiveEngine()
  const vibe = VIBES.find((entry) => entry.id === vibeId)!

  const graded = useMemo(
    () =>
      gradeVibes({
        snapshot,
        seoRun: engine?.getAuditRun?.('seo') ?? null,
        aeoRun: engine?.getAuditRun?.('aeo') ?? null,
      }).find((row) => row.id === vibeId)!,
    [snapshot, engine, vibeId],
  )

  const caughtTitle =
    graded.state === 'caught' && graded.issues[0]
      ? getSuggestion(graded.issues[0], 'vibe').title
      : null

  const stateWord =
    graded.state === 'caught' && caughtTitle
      ? `Caught: ${caughtTitle}`
      : STATE_LABEL[graded.state]

  const showDot = graded.state === 'caught' || graded.state === 'rechecking' || graded.state === 'incomplete'
  const dotColor =
    graded.state === 'caught'
      ? 'var(--vc-bad, #b91c1c)'
      : graded.state === 'rechecking'
        ? 'var(--vc-warn, #b45309)'
        : 'transparent'

  return (
    <div
      role="group"
      aria-labelledby={`vibe-${vibeId}-name`}
      className="vc-ledger-row"
      data-vc-vibe={vibeId}
      data-vc-state={graded.state}
      style={{
        padding: '22px 0',
        borderBottom: '1px solid var(--vc-line-2, var(--vc-line))',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 16,
          alignItems: 'baseline',
        }}
      >
        <div>
          <div
            id={`vibe-${vibeId}-name`}
            style={{
              fontFamily: 'var(--vc-serif)',
              fontWeight: 500,
              fontSize: 'clamp(24px, 21.03px + 0.762vw, 32px)',
              lineHeight: 1.15,
              letterSpacing: '-0.015em',
            }}
          >
            {vibe.name}
          </div>
          <p
            style={{
              margin: '6px 0 0',
              fontFamily: 'var(--vc-serif)',
              fontWeight: 400,
              fontSize: 18,
              color: 'var(--vc-ink-2)',
              lineHeight: 1.4,
            }}
          >
            {vibe.claim}
          </p>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--vc-ink-2)',
            whiteSpace: 'nowrap',
          }}
        >
          {showDot ? (
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: dotColor,
                border: graded.state === 'incomplete' ? '1px solid var(--vc-ink-3)' : undefined,
                flex: 'none',
              }}
            />
          ) : graded.state === 'passing' || graded.state === 'passing-again' ? (
            <span aria-hidden style={{ color: 'var(--vc-ink)' }}>✓</span>
          ) : null}
          <span>{stateWord}</span>
        </div>
      </div>

      <p
        className="vc-mono"
        style={{
          margin: '14px 0 0',
          fontSize: 14,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--vc-ink)',
        }}
      >
        {graded.reading}
      </p>

      {graded.state === 'caught' && graded.issues[0] ? (
        <div style={{ marginTop: 14 }}>
          <CopyButton
            text={getAgentPrompt([graded.issues[0]], 'vibe')}
            label="Copy as agent prompt"
            successMessage="Copied. In your own app, Send to agent delivers this to the agent watching your project. Here it's only on your clipboard. Nothing was sent."
          />
        </div>
      ) : null}

      <details style={{ marginTop: 14 }}>
        <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
          What it checks
        </summary>
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: 'var(--vc-ink-2)', fontSize: 14, lineHeight: 1.5 }}>
          {CHECKS[vibeId].map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  )
}
