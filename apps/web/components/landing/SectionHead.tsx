interface SectionHeadProps {
  readonly title: string
  readonly sub?: string
  readonly index?: string
}

export const SectionHead = ({ title, sub }: SectionHeadProps) => (
  <div className="vc-sechead">
    <div className="vc-sechead-row">
      <h2>{title}</h2>
      {sub ? <span className="vc-sub">{sub}</span> : null}
    </div>
  </div>
)
