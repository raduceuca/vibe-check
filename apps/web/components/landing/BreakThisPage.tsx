'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ── Real fault triggers ───────────────────────────────────────────────────────
// Each button induces a genuine performance fault on THIS page; the live widget
// in the corner catches it. Reuses the anti-pattern shapes from the demo app.
// "Reset the instrument" undoes every fault and returns the page to calm.

const DUPLICATE_URL = '/vibe-check/duplicate-probe'
const INJECT_NODE_COUNT = 10_000
const LEAK_CHUNK = 60_000 // numbers retained per tick (~0.5MB) — heap climbs fast

type FaultKey =
  | 'memory'
  | 'dom'
  | 'layout'
  | 'requests'
  | 'errors'

interface Fault {
  readonly key: FaultKey
  readonly label: string
  readonly detail: string
}

const FAULTS: readonly Fault[] = [
  {
    key: 'memory',
    label: 'Leak memory',
    detail: 'Retains a growing array every tick. The heap climbs; the memory-leak detector fires (Chromium).',
  },
  {
    key: 'dom',
    label: 'Bloat the DOM',
    detail: `Injects ${INJECT_NODE_COUNT.toLocaleString()} throwaway nodes. Node count spikes past the DOM-bloat threshold.`,
  },
  {
    key: 'layout',
    label: 'Shift the layout',
    detail: 'Drops a late banner with no reserved space. The page janks and CLS jumps — that is the demo.',
  },
  {
    key: 'requests',
    label: 'Duplicate requests',
    detail: 'Fires the same fetch 8× in a burst. The duplicate-request detector lists them.',
  },
  {
    key: 'errors',
    label: 'Throw errors',
    detail: 'Streams console errors past the spam threshold. The console collector counts them live.',
  },
]

export const BreakThisPage = () => {
  const [armed, setArmed] = useState<ReadonlySet<FaultKey>>(new Set())
  const [sinkOpen, setSinkOpen] = useState(false)

  // Imperative resource handles (timers + injected DOM) — cleaned up on reset
  // and on unmount so nothing leaks past the visit.
  const leakStore = useRef<number[][]>([])
  const leakTimer = useRef<number | null>(null)
  const errorTimer = useRef<number | null>(null)
  const bannerEl = useRef<HTMLDivElement | null>(null)
  const sinkRef = useRef<HTMLDivElement | null>(null)

  const arm = useCallback((key: FaultKey) => {
    setArmed((prev) => {
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }, [])

  const leakMemory = useCallback(() => {
    if (leakTimer.current !== null) return
    arm('memory')
    leakTimer.current = window.setInterval(() => {
      // Retain an ever-growing set of arrays so GC can't reclaim them.
      leakStore.current.push(new Array(LEAK_CHUNK).fill(Math.random()))
    }, 250)
  }, [arm])

  const bloatDom = useCallback(() => {
    const sink = sinkRef.current
    if (!sink) return
    arm('dom')
    setSinkOpen(true)
    const frag = document.createDocumentFragment()
    for (let i = 0; i < INJECT_NODE_COUNT; i++) {
      const node = document.createElement('span')
      node.className = 'vc-sink-node'
      frag.appendChild(node)
    }
    sink.appendChild(frag)
  }, [arm])

  const shiftLayout = useCallback(() => {
    if (bannerEl.current) return
    arm('layout')
    // Insert a late, unreserved banner at the very top of the document so the
    // whole page shifts down — a real Cumulative Layout Shift.
    window.setTimeout(() => {
      const banner = document.createElement('div')
      banner.textContent = 'Late-loading announcement bar — no space was reserved for me.'
      banner.style.cssText = [
        'padding:14px 20px',
        'font:600 13px/1.4 ui-monospace,SF Mono,monospace',
        'color:#fff',
        'background:#c0362c',
        'text-align:center',
        'position:relative',
        'z-index:1',
      ].join(';')
      document.body.insertBefore(banner, document.body.firstChild)
      bannerEl.current = banner
    }, 500)
  }, [arm])

  const duplicateRequests = useCallback(() => {
    arm('requests')
    for (let i = 0; i < 8; i++) {
      // Identical URL, cache bypassed, so all 8 are real, de-dupable requests.
      fetch(DUPLICATE_URL, { cache: 'no-store' }).catch(() => {})
    }
  }, [arm])

  const throwErrors = useCallback(() => {
    if (errorTimer.current !== null) return
    arm('errors')
    let fired = 0
    const messages = [
      'TypeError: Cannot read properties of undefined (reading \'map\')',
      'Error: Failed to fetch (status 500)',
      'Warning: Each child in a list should have a unique "key" prop',
      'Uncaught (in promise): Hydration failed',
    ]
    // Stream a burst that clears the console-spam threshold (>20 / 10s).
    errorTimer.current = window.setInterval(() => {
      // Intentional: this trigger's whole purpose is to emit console errors
      // for the collector to count. Not stray debug logging.
      console.error(messages[fired % messages.length], { seq: fired })
      fired++
      if (fired >= 30 && errorTimer.current !== null) {
        window.clearInterval(errorTimer.current)
        errorTimer.current = null
      }
    }, 250)
  }, [arm])

  const runners: Record<FaultKey, () => void> = {
    memory: leakMemory,
    dom: bloatDom,
    layout: shiftLayout,
    requests: duplicateRequests,
    errors: throwErrors,
  }

  const reset = useCallback(() => {
    if (leakTimer.current !== null) {
      window.clearInterval(leakTimer.current)
      leakTimer.current = null
    }
    if (errorTimer.current !== null) {
      window.clearInterval(errorTimer.current)
      errorTimer.current = null
    }
    leakStore.current = []
    if (bannerEl.current) {
      bannerEl.current.remove()
      bannerEl.current = null
    }
    if (sinkRef.current) sinkRef.current.replaceChildren()
    setSinkOpen(false)
    setArmed(new Set())
  }, [])

  // Never leave faults running after the section unmounts.
  useEffect(() => reset, [reset])

  return (
    <div>
      <div className="vc-rack">
        {FAULTS.map((fault) => (
          <button
            key={fault.key}
            type="button"
            className="vc-btn"
            data-armed={armed.has(fault.key)}
            onClick={runners[fault.key]}
            title={fault.detail}
          >
            <span className="vc-btn-dot" />
            <span>{fault.label}</span>
            {armed.has(fault.key) && <span className="vc-btn-k">armed</span>}
          </button>
        ))}
        <button
          type="button"
          className="vc-btn vc-btn-ok"
          onClick={reset}
          title="Undo every fault and return the widget to calm green."
        >
          <span className="vc-btn-dot" />
          <span>Reset the instrument</span>
        </button>
      </div>

      <div className="vc-rack-note">
        <span className="vc-live-dot" data-armed={armed.size > 0} />
        {armed.size > 0
          ? `${armed.size} fault${armed.size > 1 ? 's' : ''} live — watch the corner widget catch ${armed.size > 1 ? 'them' : 'it'}.`
          : 'Calm at rest. Trip a fault above; the widget in the corner notices within a few seconds.'}
      </div>

      {/* Bounded sink for injected DOM nodes so the page stays usable. */}
      <div className="vc-sink" data-open={sinkOpen} ref={sinkRef} aria-hidden="true" />
    </div>
  )
}
