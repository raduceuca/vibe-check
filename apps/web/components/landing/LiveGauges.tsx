'use client'

import { useEffect, useState } from 'react'
import {
  FrameRateCollector,
  LongFrameCollector,
  MemoryCollector,
  WebVitalsCollector,
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  type FrameRateStats,
  type LongFrameStats,
  type WebVitalsStats,
  type HeapMemory,
} from '@wcgw/vibe-check-core'
import { CalibrationRuler } from '@/components/brand/ProofMarks'
import { LANDING_COPY } from '@/lib/landingCopy'

// ── Live gauges — the always-measuring layer ─────────────────────────────────
// The measurement half of the story the bestiary tells the catching half of.
// We spin up the SAME real collectors the widget ships (frame rate, LoAF long
// tasks, JS-heap memory, Core Web Vitals) straight from core and stream their
// live stats — so the six readings below are THIS page's actual numbers, not a
// mockup. Mirrors AuditThisPage's approach (use the real package, don't reach
// into the widget's engine). SSR renders the empty placeholders, so the chips
// occupy stable space and never shift layout — fitting, for this product.

type Tone = 'ok' | 'warn' | 'bad' | 'idle'

const vitalTone = (rating?: string): Tone =>
  rating === 'good'
    ? 'ok'
    : rating === 'needs-improvement'
      ? 'warn'
      : rating === 'poor'
        ? 'bad'
        : 'idle'

const fpsTone = (fps: number): Tone => (fps <= 0 ? 'idle' : fps >= 55 ? 'ok' : fps >= 30 ? 'warn' : 'bad')
const jankTone = (count: number): Tone => (count === 0 ? 'ok' : count <= 3 ? 'warn' : 'bad')
const memTone = (pct: number): Tone => (pct <= 0 ? 'idle' : pct < 60 ? 'ok' : pct < 85 ? 'warn' : 'bad')

const round = (n: number): string => String(Math.round(n))
const one = (n: number): string => n.toFixed(1)

interface Gauge {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly unit: string
  readonly sub: string
  readonly tone: Tone
}

const buildGauges = (
  frame: FrameRateStats,
  longFrames: LongFrameStats,
  memory: HeapMemory | null,
  vitals: WebVitalsStats,
): readonly Gauge[] => [
  {
    key: 'fps',
    label: 'Frame rate',
    value: frame.fps > 0 ? round(frame.fps) : '—',
    unit: 'fps',
    sub: frame.fps > 0 ? `${one(frame.avgFrameTime)}ms avg` : 'measuring…',
    tone: fpsTone(frame.fps),
  },
  {
    key: 'longframes',
    label: 'Long frames',
    value: round(longFrames.count),
    unit: longFrames.count === 1 ? 'frame' : 'frames',
    sub: longFrames.count > 0 ? `worst ${round(longFrames.worstFrame)}ms` : 'main thread clear',
    tone: jankTone(longFrames.count),
  },
  {
    key: 'memory',
    label: 'JS heap',
    value: memory ? round(memory.jsHeapSizeMB) : 'n/a',
    unit: memory ? 'MB' : '',
    sub: memory ? `${round(memory.usedPct)}% of limit` : 'Chromium only',
    tone: memory ? memTone(memory.usedPct) : 'idle',
  },
  {
    key: 'lcp',
    label: 'LCP',
    value: vitals.lcp ? one(vitals.lcp.value / 1000) : '—',
    unit: vitals.lcp ? 's' : '',
    sub: vitals.lcp ? 'largest paint' : 'measuring…',
    tone: vitalTone(vitals.lcp?.rating),
  },
  {
    key: 'cls',
    label: 'CLS',
    value: vitals.cls ? vitals.cls.value.toFixed(3) : '—',
    unit: '',
    sub: vitals.cls ? 'layout shift' : 'none yet',
    tone: vitalTone(vitals.cls?.rating),
  },
  {
    key: 'inp',
    label: 'INP',
    value: vitals.inp ? round(vitals.inp.value) : '—',
    unit: vitals.inp ? 'ms' : '',
    sub: vitals.inp ? 'interaction' : 'interact to read',
    tone: vitalTone(vitals.inp?.rating),
  },
]

export const LiveGauges = () => {
  const [frame, setFrame] = useState<FrameRateStats>(EMPTY_FRAME_RATE_STATS)
  const [longFrames, setLongFrames] = useState<LongFrameStats>(EMPTY_LONG_FRAME_STATS)
  const [memory, setMemory] = useState<HeapMemory | null>(null)
  const [vitals, setVitals] = useState<WebVitalsStats>(EMPTY_WEB_VITALS)

  useEffect(() => {
    const frameRate = new FrameRateCollector()
    const longFrame = new LongFrameCollector()
    const heap = new MemoryCollector()
    const webVitals = new WebVitalsCollector()

    const unsubscribes = [
      frameRate.onUpdate(setFrame),
      longFrame.onUpdate(setLongFrames),
      heap.onUpdate(setMemory),
      webVitals.onUpdate(setVitals),
    ]

    frameRate.start()
    longFrame.start()
    heap.start()
    webVitals.start()

    return () => {
      for (const off of unsubscribes) off()
      frameRate.stop()
      longFrame.stop()
      heap.stop()
      webVitals.stop()
    }
  }, [])

  const gauges = buildGauges(frame, longFrames, memory, vitals)

  return (
    <div className="vc-gauges" aria-label="Live performance readings for this page">
      <div className="vc-gauges-head">
        <span className="vc-gauges-live" aria-hidden="true" />
        <span className="vc-gauges-live-label">{LANDING_COPY.gauges.header}</span>
        <CalibrationRuler className="vc-gauges-ruler" />
        <span className="vc-gauges-note">{LANDING_COPY.gauges.note}</span>
      </div>
      <div className="vc-gauges-grid">
        {gauges.map((g, index) => {
          const proofIndex = String(index + 1).padStart(2, '0')
          return (
            <div
              className="vc-gauge"
              key={g.key}
              data-tone={g.tone}
              data-proof-index={proofIndex}
            >
              <div className="vc-gauge-top">
                <span className="vc-gauge-lab">{g.label}</span>
                <span className="vc-gauge-dot" aria-hidden="true" />
              </div>
              <div className="vc-gauge-read">
                <span className="vc-gauge-val">{g.value}</span>
                {g.unit ? <span className="vc-gauge-unit">{g.unit}</span> : null}
              </div>
              <span className="vc-gauge-sub">{g.sub}</span>
              <span className="vc-gauge-index" aria-hidden="true">
                {proofIndex}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
