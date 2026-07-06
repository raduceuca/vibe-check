interface SectionHeadProps {
  readonly num: string
  readonly title: string
  readonly sub?: string
}

// Numbered, hairline-ruled section header — the plan's diagnostic register.
export const SectionHead = ({ num, title, sub }: SectionHeadProps) => (
  <div className="vc-sechead">
    <span className="vc-num">{num}</span>
    <h2>{title}</h2>
    {sub && <span className="vc-sub">{sub}</span>}
  </div>
)
