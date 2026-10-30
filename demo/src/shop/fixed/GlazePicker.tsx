/** Reference fix: glaze work split into requestIdleCallback chunks. */
import { useState } from 'react'
import { GLAZE_OPTIONS } from '../data/products'
import { h2, section, ink, mute, soft } from '../styles'

const runIdleBurst = (): void => {
  let remaining = 6
  const step = (deadline: IdleDeadline) => {
    while (remaining > 0 && (deadline.timeRemaining() > 8 || deadline.didTimeout)) {
      // tiny intentional work slice — stays under long-task threshold
      const end = performance.now() + 8
      while (performance.now() < end) {
        /* slice */
      }
      remaining -= 1
    }
    if (remaining > 0) {
      const ric = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({
        didTimeout: false,
        timeRemaining: () => 12,
      } as IdleDeadline), 1) as unknown as number)
      ric(step, { timeout: 200 })
    }
  }
  const ric = window.requestIdleCallback ?? ((cb: IdleRequestCallback) => window.setTimeout(() => cb({
    didTimeout: false,
    timeRemaining: () => 12,
  } as IdleDeadline), 1) as unknown as number)
  ric(step, { timeout: 200 })
}

export const GlazePicker = () => {
  const [glaze, setGlaze] = useState<(typeof GLAZE_OPTIONS)[number]>('Tide Blue')

  const onChange = (next: (typeof GLAZE_OPTIONS)[number]) => {
    setGlaze(next)
    runIdleBurst()
  }

  return (
    <section id="glazes" style={section}>
      <h2 style={h2}>Pick a glaze</h2>
      <p style={{ color: mute, margin: '0 0 16px', maxWidth: 480 }}>
        Choose a glaze to preview on the Harbor mug. Work runs in idle chunks.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {GLAZE_OPTIONS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onChange(g)}
            style={{
              border: glaze === g ? `1px solid ${ink}` : '1px solid #ddd',
              background: glaze === g ? soft : '#fff',
              color: ink,
              padding: '8px 14px',
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: 0,
            }}
          >
            {g}
          </button>
        ))}
      </div>
      <p style={{ color: mute, fontSize: 14 }}>
        Selected: <strong style={{ color: ink, fontWeight: 500 }}>{glaze}</strong>
      </p>
    </section>
  )
}
