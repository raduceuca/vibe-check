import Link from 'next/link'
import { LANDING_COPY } from '@/lib/landingCopy'
import { StepHead } from './StepHead'

export const LoopSteps = () => (
  <section id="loop" className="vc-section" aria-labelledby="loop-heading">
    <StepHead id="loop-heading" title={LANDING_COPY.loop.title} lede={LANDING_COPY.loop.body} />
    <ol className="vc-loop" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {LANDING_COPY.loop.steps.map((step, index) => (
        <li
          key={step.name}
          style={{
            padding: '20px 0',
            borderTop: index === 0 ? '1px solid var(--vc-line-2, var(--vc-line))' : undefined,
            borderBottom: '1px solid var(--vc-line-2, var(--vc-line))',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--vc-serif)',
              fontWeight: 500,
              fontSize: 'clamp(22px, 20px + 0.5vw, 28px)',
              letterSpacing: '-0.01em',
            }}
          >
            {step.name}
            {step.yours ? (
              <span
                style={{
                  marginLeft: 10,
                  fontFamily: 'var(--vc-sans)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--vc-ink-3)',
                }}
              >
                Your step
              </span>
            ) : null}
          </h3>
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--vc-serif)',
              fontWeight: 400,
              fontSize: 18,
              lineHeight: 1.45,
              color: 'var(--vc-ink-2)',
            }}
          >
            {step.sentence}
          </p>
          <p style={{ margin: '10px 0 0' }}>
            <Link className="vc-link" href={step.href} style={{ fontSize: 15 }}>
              {step.link}
            </Link>
          </p>
        </li>
      ))}
    </ol>
  </section>
)
