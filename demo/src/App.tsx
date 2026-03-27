import { useState, useEffect, useRef } from 'react'
import { VibeCheck } from '@wcgw/vibe-check'

// ── 1. Console Spam ──────────────────────────────────────────────────────────

const ConsoleSpammer = () => {
  const [count, setCount] = useState(0)
  const [spamming, setSpamming] = useState(false)

  useEffect(() => {
    if (!spamming) return
    const id = setInterval(() => {
      for (let i = 0; i < 5; i++) {
        console.log('polling API...', { tick: count, i })
      }
      setCount((c) => c + 1)
    }, 400)
    return () => clearInterval(id)
  }, [spamming, count])

  return (
    <Card title="Console Spam" detector="console-spam" desc="AI-generated code that logs excessively in a loop.">
      <button style={spamming ? buttonDangerStyle : buttonStyle} onClick={() => setSpamming((s) => !s)}>
        {spamming ? 'Stop' : 'Start Spamming'}
      </button>
      <p style={metricStyle}>console.log calls: {count * 5}</p>
    </Card>
  )
}

// ── 2. Console Errors & Warnings ─────────────────────────────────────────────

const ConsoleErrors = () => {
  const [errorCount, setErrorCount] = useState(0)
  const [warnCount, setWarnCount] = useState(0)

  const fireErrors = () => {
    console.error('Uncaught TypeError: Cannot read properties of undefined (reading "map")')
    console.error('Error: Failed to fetch user data', { status: 500, url: '/api/users' })
    console.error('React: Each child in a list should have a unique "key" prop')
    setErrorCount((c) => c + 3)
  }

  const fireWarnings = () => {
    console.warn('Warning: componentWillMount has been renamed')
    console.warn('React Router: No routes matched location "/undefined"')
    console.warn('Warning: Can\'t perform a React state update on an unmounted component')
    console.warn('[Deprecation] SharedArrayBuffer usage without cross-origin isolation')
    setWarnCount((c) => c + 4)
  }

  return (
    <Card title="Console Errors & Warnings" detector="console-spam" desc="Common errors from AI-generated code — missing keys, undefined access, deprecated APIs.">
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ ...buttonStyle, background: '#f87171', color: '#fff' }} onClick={fireErrors}>
          Fire 3 Errors
        </button>
        <button style={{ ...buttonStyle, background: '#facc15', color: '#000' }} onClick={fireWarnings}>
          Fire 4 Warnings
        </button>
      </div>
      <p style={metricStyle}>Errors: {errorCount} / Warnings: {warnCount}</p>
    </Card>
  )
}

// ── 3. DOM Bloat ─────────────────────────────────────────────────────────────

const DomBloater = () => {
  const [nodeCount, setNodeCount] = useState(0)

  return (
    <Card title="DOM Bloat" detector="dom-bloat" desc="Adds DOM nodes without virtualization. Warn at 800, error at 1500.">
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={buttonStyle} onClick={() => setNodeCount((c) => c + 200)}>+200 Nodes</button>
        <button style={buttonStyle} onClick={() => setNodeCount((c) => c + 500)}>+500 Nodes</button>
        <button style={buttonMutedStyle} onClick={() => setNodeCount(0)}>Reset</button>
      </div>
      <p style={metricStyle}>Nodes: {nodeCount}</p>
      <div style={{ maxHeight: 60, overflow: 'hidden', marginTop: 4 }}>
        {Array.from({ length: nodeCount }, (_, i) => (
          <span key={i} style={{ display: 'inline-block', width: 3, height: 3, background: '#4ade80', margin: '0.5px', borderRadius: 1, opacity: 0.6 }} />
        ))}
      </div>
    </Card>
  )
}

// ── 4. Duplicate Requests ────────────────────────────────────────────────────

const DuplicateFetcher = () => {
  const [fetchCount, setFetchCount] = useState(0)

  const fireDuplicates = () => {
    const url = 'https://jsonplaceholder.typicode.com/posts/1'
    fetch(url).catch(() => {})
    fetch(url).catch(() => {})
    fetch(url).catch(() => {})
    setFetchCount((c) => c + 3)
  }

  const fireMixed = () => {
    // Different endpoints hit multiple times — simulates components each fetching their own data
    fetch('https://jsonplaceholder.typicode.com/users/1').catch(() => {})
    fetch('https://jsonplaceholder.typicode.com/users/1').catch(() => {})
    fetch('https://jsonplaceholder.typicode.com/todos/1').catch(() => {})
    fetch('https://jsonplaceholder.typicode.com/todos/1').catch(() => {})
    setFetchCount((c) => c + 4)
  }

  return (
    <Card title="Duplicate Requests" detector="duplicate-requests" desc="Same URL fetched multiple times with no caching (React Query, SWR).">
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={buttonStyle} onClick={fireDuplicates}>3x Same URL</button>
        <button style={buttonStyle} onClick={fireMixed}>2x Two URLs</button>
      </div>
      <p style={metricStyle}>Total fetches: {fetchCount}</p>
    </Card>
  )
}

// ── 5. Unoptimized Images ────────────────────────────────────────────────────

const UnoptimizedImages = () => {
  const [show, setShow] = useState(false)

  return (
    <Card title="Unoptimized Images" detector="unoptimized-images" desc="Missing loading='lazy', width, height attributes — causes CLS.">
      <button style={buttonStyle} onClick={() => setShow((s) => !s)}>
        {show ? 'Hide' : 'Show Bad Images'}
      </button>
      {show && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* No width, height, or loading="lazy" */}
          <img src="https://picsum.photos/800/600" alt="no dimensions" style={{ maxWidth: 100, borderRadius: 4 }} />
          <img src="https://picsum.photos/801/601" alt="no lazy" style={{ maxWidth: 100, borderRadius: 4 }} />
          {/* Oversized: 2000px natural rendered at 100px */}
          <img src="https://picsum.photos/2000/1500" alt="oversized render" style={{ maxWidth: 100, borderRadius: 4 }} />
        </div>
      )}
    </Card>
  )
}

// ── 6. Large Images ──────────────────────────────────────────────────────────

const LargeImages = () => {
  const [show, setShow] = useState(false)

  return (
    <Card title="Large Images (>500KB)" detector="large-images" desc="Uncompressed images — should use WebP/AVIF and match render dimensions.">
      <button style={buttonStyle} onClick={() => setShow((s) => !s)}>
        {show ? 'Hide' : 'Load Heavy Images'}
      </button>
      {show && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          {/* These are large uncompressed images */}
          <img src="https://picsum.photos/3000/2000" alt="3000x2000 image" width={150} height={100} style={{ borderRadius: 4, objectFit: 'cover' }} />
          <img src="https://picsum.photos/4000/3000" alt="4000x3000 image" width={150} height={100} style={{ borderRadius: 4, objectFit: 'cover' }} />
        </div>
      )}
    </Card>
  )
}

// ── 7. Layout Thrashing ──────────────────────────────────────────────────────

const LayoutThrasher = () => {
  const thrash = () => {
    const el = document.createElement('div')
    el.style.cssText = 'position:absolute;top:-9999px;width:100px'
    document.body.appendChild(el)
    for (let i = 0; i < 50; i++) {
      el.style.width = `${100 + i}px`
      void el.offsetWidth // Force synchronous layout
    }
    document.body.removeChild(el)
  }

  return (
    <Card title="Layout Thrashing" detector="layout-thrashing" desc="Read/write geometry in a loop — forced synchronous reflows.">
      <button style={buttonStyle} onClick={thrash}>Thrash 50 Reflows</button>
    </Card>
  )
}

// ── 8. Memory Leak ───────────────────────────────────────────────────────────

const MemoryLeaker = () => {
  const leakedArrays = useRef<number[][]>([])
  const [leaking, setLeaking] = useState(false)
  const [sizeMB, setSizeMB] = useState(0)

  useEffect(() => {
    if (!leaking) return
    const id = setInterval(() => {
      // Allocate ~1MB per tick without releasing
      const arr = new Array(250_000).fill(Math.random())
      leakedArrays.current.push(arr)
      setSizeMB(leakedArrays.current.length)
    }, 1000)
    return () => clearInterval(id)
  }, [leaking])

  const cleanup = () => {
    leakedArrays.current = []
    setLeaking(false)
    setSizeMB(0)
  }

  return (
    <Card title="Memory Leak" detector="memory-leak" desc="Accumulates arrays without releasing — heap grows without GC recovery.">
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={leaking ? buttonDangerStyle : buttonStyle} onClick={() => setLeaking((s) => !s)}>
          {leaking ? 'Stop Leaking' : 'Start Leaking'}
        </button>
        <button style={buttonMutedStyle} onClick={cleanup}>Release Memory</button>
      </div>
      <p style={metricStyle}>~{sizeMB}MB leaked (retained arrays)</p>
    </Card>
  )
}

// ── 9. Long Task / Main Thread Blocking ──────────────────────────────────────

const LongTaskBlocker = () => {
  const blockMainThread = (ms: number) => {
    const start = performance.now()
    // Busy-wait to simulate heavy computation
    while (performance.now() - start < ms) {
      Math.random()
    }
  }

  return (
    <Card title="Long Tasks" detector="long-task-attribution" desc="Block the main thread with computation — triggers LoAF detection.">
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={buttonStyle} onClick={() => blockMainThread(100)}>Block 100ms</button>
        <button style={{ ...buttonStyle, background: '#facc15', color: '#000' }} onClick={() => blockMainThread(300)}>Block 300ms</button>
        <button style={{ ...buttonStyle, background: '#f87171', color: '#fff' }} onClick={() => blockMainThread(1000)}>Block 1s</button>
      </div>
    </Card>
  )
}

// ── 10. Web Essentials ───────────────────────────────────────────────────────

const WebEssentials = () => (
  <Card title="Web Essentials" detector="web-essentials" desc="Auto-checks for missing favicon, viewport, lang, charset, title, meta description.">
    <p style={{ ...metricStyle, color: '#888' }}>
      This detector runs automatically on page load. Check the Issues panel for any missing essentials in this demo page.
    </p>
    <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'SF Mono, Menlo, monospace', lineHeight: 1.8 }}>
      <div>
        <span style={checkStyle(!!document.querySelector('link[rel="icon"]'))}>favicon</span>
        <span style={checkStyle(!!document.querySelector('meta[name="viewport"]'))}>viewport</span>
        <span style={checkStyle(!!document.documentElement.lang)}>lang</span>
        <span style={checkStyle(!!document.querySelector('meta[charset]'))}>charset</span>
        <span style={checkStyle(!!document.title)}>title</span>
        <span style={checkStyle(!!document.querySelector('meta[name="description"]'))}>description</span>
      </div>
    </div>
  </Card>
)

const checkStyle = (pass: boolean): React.CSSProperties => ({
  display: 'inline-block',
  padding: '1px 8px',
  margin: '2px 4px 2px 0',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 600,
  background: pass ? 'rgba(74, 222, 128, 0.12)' : 'rgba(248, 113, 113, 0.12)',
  color: pass ? '#4ade80' : '#f87171',
  border: `1px solid ${pass ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
})

// ── 11. Rapid Re-renders (bonus — visual only, not yet detected) ─────────────

const RapidRerenderer = () => {
  const [tick, setTick] = useState(0)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => {
      setTick((t) => t + 1)
    }, 16) // 60fps state updates — every render creates new objects
    return () => clearInterval(id)
  }, [running])

  return (
    <Card title="Rapid Re-renders" detector="fps impact" desc="setState at 60fps with inline objects — watch FPS drop in the monitor.">
      <button style={running ? buttonDangerStyle : buttonStyle} onClick={() => setRunning((s) => !s)}>
        {running ? 'Stop' : 'Re-render at 60fps'}
      </button>
      <p style={metricStyle}>Renders: {tick}</p>
      {/* Inline objects on every render — classic AI anti-pattern */}
      {running && Array.from({ length: 20 }, (_, i) => (
        <div key={i} style={{ display: 'inline-block', width: 8, height: 8, margin: 1, borderRadius: '50%', background: `hsl(${(tick * 3 + i * 18) % 360}, 70%, 60%)` }} />
      ))}
    </Card>
  )
}

// ── Card wrapper ─────────────────────────────────────────────────────────────

const Card = ({ title, detector, desc, children }: {
  title: string
  detector: string
  desc: string
  children: React.ReactNode
}) => (
  <div style={cardStyle}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <h3 style={cardTitleStyle}>{title}</h3>
      <span style={detectorBadgeStyle}>{detector}</span>
    </div>
    <p style={descStyle}>{desc}</p>
    {children}
  </div>
)

// ── App ──────────────────────────────────────────────────────────────────────

function App() {
  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
          <span style={{ color: '#4ade80' }}>vibe-check</span>
          <span style={{ color: '#666', fontWeight: 400 }}> / demo</span>
        </h1>
        <p style={{ margin: '6px 0 0', color: '#888', fontSize: 13, lineHeight: 1.5 }}>
          Trigger anti-patterns below. The overlay detects issues in real time.
          <br />
          <span style={{ color: '#555', fontSize: 12 }}>
            Each card maps to a detector — click buttons and watch the Issues panel update.
          </span>
        </p>
      </header>

      <div style={gridStyle}>
        <ConsoleSpammer />
        <ConsoleErrors />
        <DomBloater />
        <DuplicateFetcher />
        <UnoptimizedImages />
        <LargeImages />
        <LayoutThrasher />
        <MemoryLeaker />
        <LongTaskBlocker />
        <WebEssentials />
        <RapidRerenderer />
      </div>

      <VibeCheck enabled position="bottom-right" beaconUrl="http://localhost:4200" />
    </div>
  )
}

export default App

// ── Styles ───────────────────────────────────────────────────────────────────

const appStyle: React.CSSProperties = {
  maxWidth: 900,
  margin: '0 auto',
  padding: '40px 20px 120px',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#e5e5e5',
  minHeight: '100vh',
}

const headerStyle: React.CSSProperties = {
  marginBottom: 28,
  paddingBottom: 16,
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
}

const cardStyle: React.CSSProperties = {
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.04)',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
}

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  fontWeight: 600,
  color: '#fff',
}

const detectorBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontFamily: 'SF Mono, Menlo, monospace',
  color: '#666',
  background: 'rgba(255,255,255,0.06)',
  padding: '2px 6px',
  borderRadius: 3,
  letterSpacing: '0.5px',
}

const descStyle: React.CSSProperties = {
  margin: '0 0 10px',
  fontSize: 12,
  color: '#888',
  lineHeight: 1.5,
}

const buttonStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 5,
  border: 'none',
  background: '#4ade80',
  color: '#000',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

const buttonDangerStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#f87171',
  color: '#fff',
}

const buttonMutedStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(255,255,255,0.1)',
  color: '#999',
}

const metricStyle: React.CSSProperties = {
  marginTop: 8,
  marginBottom: 0,
  fontSize: 11,
  color: '#555',
  fontFamily: 'SF Mono, Menlo, monospace',
}
