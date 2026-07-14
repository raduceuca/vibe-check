import { ProofRail } from '@/components/brand/ProofMarks'

interface SectionHeadProps {
  readonly title: string
  readonly sub?: string
  readonly index?: string
}

// Hairline-ruled section header — title leads, optional mono sub on the right.
export const SectionHead = ({ title, sub, index }: SectionHeadProps) => (
  <div className="vc-sechead">
    {index ? (
      <ProofRail
        className="vc-sechead-proof"
        label={`PROOF ${index}`}
        weight="section"
      />
    ) : null}
    <div className="vc-sechead-row" data-vc-section-proof={index}>
      <h2>{title}</h2>
      {sub ? <span className="vc-sub">{sub}</span> : null}
    </div>
  </div>
)
