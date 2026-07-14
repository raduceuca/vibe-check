import { useEffect, useState } from 'react'
import { VibeCheck } from '@wcgw/vibe-check'

interface AgentReceipt {
  readonly projectId: string
  readonly detector: string
  readonly nodeCount: number
}

interface DemoImpact {
  readonly verifiedFixes: number
  readonly regressionsCaught: number
  readonly metrics: readonly {
    readonly kind: string
    readonly value: number
    readonly label: string
  }[]
}

const pageStyle = {
  minHeight: '100vh',
  boxSizing: 'border-box',
  margin: 0,
  padding: '58px 560px 48px 64px',
  color: '#f4f4f5',
  background: 'radial-gradient(circle at 82% 18%, rgba(74, 222, 128, 0.09), transparent 27%), #09090b',
  fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
} as const

const monoStyle = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
} as const

const labelStyle = {
  ...monoStyle,
  color: '#a1a1aa',
  fontSize: 12,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
} as const

const cardStyle = {
  marginTop: 28,
  padding: '22px 24px',
  border: '1px solid #27272a',
  borderRadius: 16,
  background: 'rgba(17, 17, 19, 0.88)',
  boxShadow: '0 24px 80px rgba(0, 0, 0, 0.3)',
} as const

const useBloatedDom = (): readonly [boolean, () => void, () => void] => {
  const storageKey = `vibe-check-demo-bloated:${window.location.pathname}`
  const [bloated, setBloated] = useState(() => sessionStorage.getItem(storageKey) !== 'false')
  const applyFix = () => {
    sessionStorage.setItem(storageKey, 'false')
    setBloated(false)
  }
  const reintroduceRegression = () => {
    sessionStorage.setItem(storageKey, 'true')
    setBloated(true)
  }
  return [bloated, applyFix, reintroduceRegression]
}

const BloatControls = ({
  bloated,
  onApplyFix,
  onReintroduceRegression,
}: {
  readonly bloated: boolean
  readonly onApplyFix: () => void
  readonly onReintroduceRegression: () => void
}) => (
  <section data-testid="vibe-check-demo-controls" style={cardStyle}>
    <div style={labelStyle}>Browser evidence</div>
    <strong style={{ display: 'block', marginTop: 10, color: bloated ? '#fbbf24' : '#4ade80', fontSize: 17 }}>
      {bloated ? '1,600 excess DOM nodes detected' : 'DOM bloat removed — ready to verify'}
    </strong>
    <p style={{ margin: '8px 0 16px', color: '#a1a1aa', fontSize: 13, lineHeight: 1.5 }}>
      Use these controls to demonstrate a verified repair and a later regression.
    </p>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      <button type="button" onClick={onApplyFix} disabled={!bloated}>Apply fix</button>
      <button type="button" onClick={onReintroduceRegression} disabled={bloated}>Reintroduce regression</button>
    </div>
  </section>
)

const RecordingShell = () => {
  const [receipt, setReceipt] = useState<AgentReceipt | null>(null)
  const [impact, setImpact] = useState<DemoImpact | null>(null)
  const [bloated, applyFix, reintroduceRegression] = useBloatedDom()

  useEffect(() => {
    const receive = (event: Event) => {
      setReceipt((event as CustomEvent<AgentReceipt>).detail)
    }
    window.addEventListener('vibe-check-demo-agent-received', receive)
    return () => window.removeEventListener('vibe-check-demo-agent-received', receive)
  }, [])

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_HUB_URL}/api/projects/${encodeURIComponent(window.location.origin)}/impact`,
        )
        if (response.ok && active) setImpact(await response.json() as DemoImpact)
      } catch {
        // The visible widget explains hub connectivity while the showcase keeps its last receipt.
      }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 1_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  return (
    <main data-testid="vibe-check-demo-shell" style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 22px rgba(74, 222, 128, 0.7)' }} />
        <span style={labelStyle}>Real packed-package E2E</span>
      </div>
      <h1 style={{ maxWidth: 570, margin: '24px 0 0', fontSize: 49, lineHeight: 1.02, letterSpacing: '-0.045em' }}>
        The browser found it.<br />The agent receives it.
      </h1>
      <p style={{ maxWidth: 560, margin: '20px 0 0', color: '#a1a1aa', fontSize: 17, lineHeight: 1.6 }}>
        A real VibeCheck widget is reporting DOM bloat to a local hub. One real MCP client is watching this project.
      </p>

      <section style={cardStyle}>
        <div style={labelStyle}>Project lease</div>
        <div style={{ ...monoStyle, marginTop: 10, fontSize: 13, color: '#e4e4e7', overflowWrap: 'anywhere' }}>
          {window.location.origin}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 16, color: '#d4d4d8', fontSize: 14 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
          Exactly one agent session may watch this project
        </div>
      </section>

      <section data-testid="vibe-check-demo-receipt" style={{ ...cardStyle, borderColor: receipt ? 'rgba(74, 222, 128, 0.5)' : '#27272a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <span style={labelStyle}>Agent session</span>
          <span style={{ ...monoStyle, color: receipt ? '#4ade80' : '#fbbf24', fontSize: 12 }}>
            {receipt ? '● RECEIVED' : '● WATCHING'}
          </span>
        </div>
        {receipt ? (
          <div style={{ marginTop: 14 }}>
            <strong style={{ display: 'block', color: '#4ade80', fontSize: 17 }}>Received by agent</strong>
            <div style={{ ...monoStyle, marginTop: 9, color: '#e4e4e7', fontSize: 13 }}>
              {receipt.detector} · {receipt.nodeCount.toLocaleString()} nodes
            </div>
            <div style={{ ...monoStyle, marginTop: 6, color: '#71717a', fontSize: 11, overflowWrap: 'anywhere' }}>
              project: {receipt.projectId}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 14 }}>
            <strong style={{ display: 'block', color: '#f4f4f5', fontSize: 17 }}>Waiting for issue</strong>
            <span style={{ display: 'block', marginTop: 7, color: '#71717a', fontSize: 13 }}>
              Click “Send to agent” in the real widget →
            </span>
          </div>
        )}
      </section>

      <section data-testid="vibe-check-demo-impact" style={cardStyle}>
        <div style={labelStyle}>Persisted project impact</div>
        <strong style={{ display: 'block', marginTop: 12, color: '#4ade80', fontSize: 17 }}>
          {impact?.verifiedFixes ?? 0} verified fixes
        </strong>
        <div style={{ marginTop: 7, color: '#d4d4d8', fontSize: 14 }}>
          {impact?.regressionsCaught ?? 0} regressions caught
        </div>
        {impact?.metrics.map((metric) => (
          <div key={metric.kind} style={{ marginTop: 7, color: '#a1a1aa', fontSize: 13 }}>
            {metric.value} {metric.label}
          </div>
        ))}
        <div style={{ marginTop: 10, color: '#71717a', fontSize: 12 }}>
          Stored locally per project and restored after hub restarts.
        </div>
      </section>

      <BloatControls
        bloated={bloated}
        onApplyFix={applyFix}
        onReintroduceRegression={reintroduceRegression}
      />

      {bloated && (
        <div id="bloated-tree" aria-hidden="true" style={{ display: 'none' }}>
          {Array.from({ length: 1600 }, (_, index) => <span key={index}>node {index}</span>)}
        </div>
      )}
      <VibeCheck beaconUrl={import.meta.env.VITE_HUB_URL} projectId={window.location.origin} />
    </main>
  )
}

const StandardShell = () => {
  const [bloated, applyFix, reintroduceRegression] = useBloatedDom()

  return (
    <main>
      <h1>VibeCheck MCP fixture</h1>
      <BloatControls
        bloated={bloated}
        onApplyFix={applyFix}
        onReintroduceRegression={reintroduceRegression}
      />
      {bloated && (
        <div id="bloated-tree">
          {Array.from({ length: 1600 }, (_, index) => <span key={index}>node {index}</span>)}
        </div>
      )}
      <VibeCheck
        beaconUrl={import.meta.env.VITE_HUB_URL}
        projectId={window.location.origin}
      />
    </main>
  )
}

export const App = () => {
  const recording = new URLSearchParams(window.location.search).get('recording') === '1'
  return recording ? <RecordingShell /> : <StandardShell />
}
