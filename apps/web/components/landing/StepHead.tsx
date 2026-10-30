interface StepHeadProps {
  readonly id: string
  readonly title: string
  readonly lede?: string
}

export const StepHead = ({ id, title, lede }: StepHeadProps) => (
  <div className="vc-step-head vc-sechead">
    <h2 id={id}>{title}</h2>
    {lede ? <p className="vc-p" style={{ marginTop: 10 }}>{lede}</p> : null}
  </div>
)
