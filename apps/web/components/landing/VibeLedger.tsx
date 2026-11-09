import { VIBES } from '@/lib/vibes'
import { LANDING_COPY } from '@/lib/landingCopy'
import { StepHead } from './StepHead'
import { VerdictLine } from './VerdictLine'
import { LedgerRow } from './LedgerRow'
import { RecheckAudits } from './RecheckAudits'

export const VibeLedger = () => (
  <section id="look" className="vc-section" aria-labelledby="look-heading">
    <StepHead id="look-heading" title={LANDING_COPY.look.title} lede={LANDING_COPY.look.body} />
    <VerdictLine />
    <div className="vc-ledger">
      {VIBES.map((vibe) => (
        <LedgerRow key={vibe.id} vibeId={vibe.id} />
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
      <RecheckAudits />
    </div>
    <p
      style={{
        marginTop: 16,
        fontSize: 14,
        color: 'var(--vc-ink-3)',
        lineHeight: 1.45,
      }}
    >
      {LANDING_COPY.look.caption}
    </p>
  </section>
)
