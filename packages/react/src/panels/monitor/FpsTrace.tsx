import { useState, useEffect } from 'react'

// ── Lifeline timescale ───────────────────────────────────────────────────────
// (The timescale pills themselves render via the shared Tabs pill variant.)
export const WINDOW_OPTIONS = [
  { secs: 30, label: 'live' },
  { secs: 300, label: '5m' },
  { secs: 900, label: '15m' },
  { secs: 3600, label: '1h' },
] as const

// Liveline renders to a <canvas>; jsdom (tests) and SSR have none, so we fall
// back to the lightweight SVG trace there.
export const CANVAS_OK = typeof document !== 'undefined' && (() => {
  try { return !!document.createElement('canvas').getContext('2d') } catch { return false }
})()

// ── Live FPS trace (oscilloscope) — SVG fallback when canvas is unavailable ──
// Keeps a rolling window of recent FPS samples and draws a single polyline.
export const FpsTrace = ({ fps, tick, color, width = 292, height = 24, points = 70 }: {
  fps: number; tick: number; color: string; width?: number; height?: number; points?: number
}) => {
  const [series, setSeries] = useState<readonly number[]>([])
  useEffect(() => {
    setSeries((prev) => [...prev, Math.max(0, Math.min(60, fps))].slice(-points))
  }, [tick, fps, points])

  const pad = 2
  const h = height - pad * 2
  const poly = series.map((v, i) => {
    const x = series.length <= 1 ? width : (i / (points - 1)) * width
    const y = pad + (1 - v / 60) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <polyline points={poly} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.55} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
