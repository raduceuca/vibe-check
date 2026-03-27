import type { CSSProperties, ReactNode } from 'react'

interface PanelProps {
  readonly title?: string
  readonly children: ReactNode
  readonly borderTop?: boolean
}

const panelStyle: CSSProperties = {
  padding: '6px 0',
}

const panelWithBorderStyle: CSSProperties = {
  ...panelStyle,
  marginTop: 2,
  paddingTop: 8,
  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
}

const titleStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  color: 'rgba(255, 255, 255, 0.28)',
  marginBottom: 4,
}

export const Panel = ({ title, children, borderTop }: PanelProps) => (
  <div style={borderTop ? panelWithBorderStyle : panelStyle}>
    {title ? <div style={titleStyle}>{title}</div> : null}
    {children}
  </div>
)
