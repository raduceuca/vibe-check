interface SectionHeadProps {
  readonly title: string
  readonly sub?: string
  readonly index?: string
}

// Hairline-ruled section header — title leads, optional mono sub on the right.
export const SectionHead = ({ title, sub, index }: SectionHeadProps) => (
  <div className="vc-sechead">
    {index ? (
      <span className="vc-sechead-index" data-vc-section-proof={index}>
        PLATE {index}
      </span>
    ) : null}
    <h2>{title}</h2>
    {sub && <span className="vc-sub">{sub}</span>}
  </div>
)
