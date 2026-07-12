interface SectionHeadProps {
  readonly title: string
  readonly sub?: string
}

// Hairline-ruled section header — title leads, optional mono sub on the right.
export const SectionHead = ({ title, sub }: SectionHeadProps) => (
  <div className="vc-sechead">
    <h2>{title}</h2>
    {sub && <span className="vc-sub">{sub}</span>}
  </div>
)
