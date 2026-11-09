import Link from 'next/link'
import { LANDING_COPY } from '@/lib/landingCopy'
import { StepHead } from './StepHead'
import { CopyButton } from './CopyButton'

export const PhaseLine = () => (
  <section id="confirm" className="vc-section" aria-labelledby="confirm-heading">
    <StepHead
      id="confirm-heading"
      title={LANDING_COPY.confirm.title}
      lede={LANDING_COPY.confirm.body}
    />

    <pre
      className="vc-mono"
      style={{
        margin: '18px 0 0',
        padding: 14,
        background: 'var(--vc-panel)',
        borderRadius: 8,
        fontSize: 15,
        lineHeight: 1.55,
        color: 'var(--vc-ink)',
        overflowX: 'auto',
      }}
    >
      {LANDING_COPY.confirm.phaseLine1}
      {'\n'}
      {LANDING_COPY.confirm.phaseLine2}
    </pre>

    <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vc-ink-3)', lineHeight: 1.45 }}>
      {LANDING_COPY.confirm.caption}
    </p>

    <p className="vc-p" style={{ marginTop: 18 }}>
      {LANDING_COPY.confirm.reminder}{' '}
      <Link className="vc-link" href="#look">
        {LANDING_COPY.confirm.backLink}
      </Link>
      .
    </p>

    <h3
      style={{
        margin: '28px 0 0',
        fontFamily: 'var(--vc-serif)',
        fontWeight: 500,
        fontSize: 22,
      }}
    >
      {LANDING_COPY.confirm.ledgerTitle}
    </h3>
    <p className="vc-p" style={{ marginTop: 10 }}>
      {LANDING_COPY.confirm.ledgerBody}
    </p>
    <pre
      className="vc-mono"
      style={{
        margin: '12px 0 0',
        padding: 14,
        background: 'var(--vc-panel)',
        borderRadius: 8,
        fontSize: 14,
        overflowX: 'auto',
      }}
    >
      {LANDING_COPY.confirm.statsCommand}
    </pre>
    <div style={{ marginTop: 10 }}>
      <CopyButton text={LANDING_COPY.confirm.statsCommand} />
    </div>
  </section>
)
