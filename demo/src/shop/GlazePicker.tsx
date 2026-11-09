// VIBECHECK-FAULT: long-task-attribution
import { useEffect, useState } from 'react'
import { GLAZE_OPTIONS } from './data/products'
import { h2, section, ink, mute, soft } from './styles'

const SCRIPT_ID = 'tidewell-configurator'

export const GlazePicker = () => {
  const [glaze, setGlaze] = useState<(typeof GLAZE_OPTIONS)[number]>('Tide Blue')

  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) {
      window.TidewellConfigurator?.onLoad()
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = '/vendor/configurator.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  const onChange = (next: (typeof GLAZE_OPTIONS)[number]) => {
    setGlaze(next)
    window.TidewellConfigurator?.onGlazeChange()
  }

  return (
    <section id="glazes" style={section}>
      <h2 style={h2}>Pick a glaze</h2>
      <p style={{ color: mute, margin: '0 0 16px', maxWidth: 480 }}>
        Choose a glaze to preview on the Harbor mug. The configurator runs a heavy pass on each change.
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
