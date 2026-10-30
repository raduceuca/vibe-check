import type { CSSProperties } from 'react'

const pageStyle: CSSProperties = {
  maxWidth: 640,
  margin: '0 auto',
  padding: '48px 24px 80px',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif',
  color: '#111',
  lineHeight: 1.55,
}

export const App = () => (
  <main style={pageStyle}>
    <h1 style={{ fontSize: 32, letterSpacing: '-0.02em', margin: '0 0 12px' }}>
      Vite and React, checked
    </h1>
    <p style={{ margin: '0 0 16px', fontSize: 16, color: '#333' }}>
      This example is an honest SPA. Smooth, Light, Clean and Findable pass at rest.
      Quotable reports three documented misses because a static host cannot negotiate
      markdown, the shell needs JavaScript, and there is no MCP discovery document.
    </p>
    <p style={{ margin: 0, fontSize: 15, color: '#444' }}>
      Read the{' '}
      <a href="https://vibecheck.wcgw.fun/fix/content-requires-javascript">
        content-requires-javascript
      </a>{' '}
      fix guide, then open the widget (Alt+Shift+V) to confirm the three Quotable rows.
    </p>
  </main>
)
