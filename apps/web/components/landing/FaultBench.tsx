'use client'

import { useCallback, useRef, useState } from 'react'
import { useLiveEngine } from '@/components/live/LiveEngineProvider'
import { LANDING_COPY } from '@/lib/landingCopy'
import { StepHead } from './StepHead'
import {
  FAULTS,
  VIBE_HEADING,
  VIBE_ORDER,
  faultsForVibe,
} from './faults/registry'
import type { Fault, FaultId } from './faults/types'

export const FaultBench = () => {
  const { engine } = useLiveEngine()
  const bannerRef = useRef<HTMLDivElement>(null)
  const reviewsRef = useRef<HTMLDivElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<FaultId | null>(null)
  const [status, setStatus] = useState('Pick a fault. Watch the corner.')
  const activeRef = useRef<Fault | null>(null)

  const ctx = useCallback(
    () => ({
      engine,
      bannerSlot: bannerRef.current,
      reviews: reviewsRef.current,
      photo: photoRef.current,
      setStatus,
    }),
    [engine],
  )

  const toggle = useCallback(
    (fault: Fault) => {
      const reason = fault.available()
      if (reason) {
        setStatus(reason)
        return
      }

      if (active === fault.id) {
        fault.undo(ctx())
        activeRef.current = null
        setActive(null)
        setStatus('Undone. Pick another fault.')
        return
      }

      if (activeRef.current) {
        activeRef.current.undo(ctx())
      }
      fault.run(ctx())
      activeRef.current = fault
      setActive(fault.id)
      const liveCount = 1
      setStatus(
        liveCount === 1
          ? '1 change live. Watch the corner.'
          : `${liveCount} changes live. Watch the corner.`,
      )
    },
    [active, ctx],
  )

  return (
    <section id="notice" className="vc-section" aria-labelledby="notice-heading">
      <StepHead
        id="notice-heading"
        title={LANDING_COPY.notice.title}
        lede={LANDING_COPY.notice.body[0]}
      />
      <p className="vc-p">{LANDING_COPY.notice.body[1]}</p>
      <p
        style={{
          marginTop: 14,
          fontSize: 14,
          color: 'var(--vc-ink-3)',
          lineHeight: 1.45,
        }}
      >
        {LANDING_COPY.notice.footnote}
      </p>

      <div
        className="vc-fault-bench"
        style={{
          marginTop: 22,
          border: '1px solid var(--vc-line)',
          borderRadius: 12,
          background: '#fff',
          padding: 20,
        }}
      >
        <div id="vc-banner-slot" ref={bannerRef} style={{ height: 0, overflow: 'visible' }} />

        {VIBE_ORDER.map((vibe) => {
          const faults = faultsForVibe(vibe)
          if (faults.length === 0) return null
          return (
            <div key={vibe} style={{ marginBottom: 22 }}>
              <h3
                style={{
                  margin: '0 0 12px',
                  fontFamily: 'var(--vc-serif)',
                  fontWeight: 500,
                  fontSize: 22,
                }}
              >
                {VIBE_HEADING[vibe]}
              </h3>
              <div style={{ display: 'grid', gap: 14 }}>
                {faults.map((fault) => {
                  const reason = fault.available()
                  const pressed = active === fault.id
                  return (
                    <div key={fault.id} style={{ display: 'grid', gap: 6 }}>
                      <button
                        type="button"
                        className="vc-btn vc-btn-outline"
                        aria-pressed={pressed}
                        aria-label={pressed ? `Undo: ${fault.label}` : fault.label}
                        disabled={Boolean(reason) && !pressed}
                        onClick={() => toggle(fault)}
                        style={{ width: 'fit-content', minHeight: 40, padding: '0 14px', fontSize: 14 }}
                      >
                        {pressed ? 'Undo' : fault.label}
                      </button>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--vc-ink-2)', lineHeight: 1.45 }}>
                        {pressed ? 'Live on this page.' : fault.effect}
                      </p>
                      <p style={{ margin: 0, fontSize: 14, color: 'var(--vc-ink-3)' }}>
                        {reason && !pressed
                          ? reason
                          : (
                            <>
                              Panel shows: <span style={{ color: 'var(--vc-ink)' }}>{fault.panelShows}</span>
                            </>
                            )}
                      </p>
                    </div>
                  )
                })}
              </div>
              {vibe === 'light' ? (
                <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--vc-ink-3)' }}>
                  We don&apos;t ship a heavy library or a 500 KB bundle to this page to prove a point.
                  Tidewell, the broken shop in the repo, does.
                </p>
              ) : null}
            </div>
          )
        })}

        <div
          id="vc-reviews"
          ref={reviewsRef}
          inert
          aria-hidden
          style={{ width: '100%', height: 240, overflow: 'hidden', borderTop: '1px solid var(--vc-line)' }}
        />
        <div
          id="vc-photo"
          ref={photoRef}
          style={{
            width: 320,
            height: 240,
            marginTop: 12,
            border: '1px dashed var(--vc-line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--vc-ink-3)',
            fontSize: 14,
          }}
        >
          Photo slot
        </div>

        <p
          role="status"
          aria-live="polite"
          style={{ margin: '16px 0 0', fontSize: 15, color: 'var(--vc-ink-2)' }}
        >
          {status}
        </p>
      </div>

      {/* Keep FAULTS referenced so tree-shaking never drops the registry in tests. */}
      <span hidden data-fault-count={FAULTS.length} />
    </section>
  )
}
