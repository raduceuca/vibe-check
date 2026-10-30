import { useEffect, useState } from 'react'
import { PRODUCTS } from './data/products'
import { h2, ink, mute, section, serif } from './styles'

// VIBECHECK-FAULT: memory-leak
/** Module-level array grows ~100k numbers/sec (capped ~120 MB) + resize listener every commit without remove. */

const leakBucket: number[] = []
const CAP_NUMBERS = Math.floor((120 * 1024 * 1024) / 8)

let leakTimer: ReturnType<typeof setInterval> | null = null

const ensureLeak = (): void => {
  if (leakTimer !== null) return
  leakTimer = setInterval(() => {
    if (leakBucket.length >= CAP_NUMBERS) return
    const room = Math.min(100_000, CAP_NUMBERS - leakBucket.length)
    for (let i = 0; i < room; i++) leakBucket.push(Math.random())
  }, 1000)
}

export const RecentlyViewed = () => {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0)
  const [, setRenderTick] = useState(0)

  useEffect(() => {
    ensureLeak()
  }, [])

  // Intentional: effect with no deps array re-runs every commit and never removes the listener.
  useEffect(() => {
    const onResize = (): void => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    // also bump a tick occasionally so the missing-cleanup path keeps stacking listeners
    const id = window.setTimeout(() => setRenderTick((n) => n + 1), 5000)
    return () => {
      window.clearTimeout(id)
      // intentional: do not remove onResize
    }
  })

  const items = PRODUCTS.slice(0, 4)

  return (
    <section style={section}>
      <h2 style={h2}>Recently viewed</h2>
      <p style={{ fontSize: 13, color: mute, marginTop: 0 }}>Viewport {width}px · leak {leakBucket.length}</p>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
        {items.map((p) => (
          <div key={p.id} style={{ minWidth: 140 }}>
            <img src={p.image} style={{ width: 140, height: 105, objectFit: 'cover', display: 'block' }} />
            <div style={{ fontFamily: serif, fontSize: 15, color: ink, marginTop: 6 }}>{p.name}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
