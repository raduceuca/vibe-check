import { useEffect, useState, type CSSProperties } from 'react'
import {
  RELOAD_VIBES,
  VIBE_FAULTS,
  VIBE_LABELS,
  VIBES,
  getScenarioFixed,
  isVibeFixed,
  serializeFixed,
  setScenarioFixed,
  subscribeScenarioFixed,
  type Vibe,
} from './scenarioState'

const panel: CSSProperties = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: 9998,
  width: 320,
  maxWidth: 'calc(100vw - 24px)',
  background: '#fff',
  color: '#111',
  border: '1px solid #ddd',
  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 14,
  lineHeight: 1.4,
}

const collapsedBtn: CSSProperties = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: 9998,
  height: 44,
  minWidth: 44,
  padding: '0 14px',
  background: '#111',
  color: '#fff',
  border: 'none',
  fontSize: 14,
  cursor: 'pointer',
}

const seg: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
  marginBottom: 12,
}

const segBtn = (active: boolean): CSSProperties => ({
  border: active ? '1px solid #111' : '1px solid #ddd',
  background: active ? '#111' : '#fff',
  color: active ? '#fff' : '#333',
  padding: '8px 6px',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'center',
})

const toggleRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 0',
  borderTop: '1px solid #eee',
}

export const ScenarioDrawer = () => {
  const [open, setOpen] = useState(false)
  const [fixed, setFixed] = useState<ReadonlySet<Vibe>>(() => getScenarioFixed())
  const [expanded, setExpanded] = useState<Vibe | null>(null)
  const [reloadPending, setReloadPending] = useState(false)

  useEffect(() => subscribeScenarioFixed(setFixed), [])

  const apply = (next: ReadonlySet<Vibe>, touched?: ReadonlySet<Vibe>) => {
    setScenarioFixed(next)
    const needsReload =
      touched === undefined
        ? true
        : [...touched].some((v) => RELOAD_VIBES.has(v))
    if (needsReload) setReloadPending(true)
  }

  const setAll = (mode: 'broken' | 'fixed') => {
    apply(mode === 'fixed' ? new Set(VIBES) : new Set())
  }

  const toggleVibe = (vibe: Vibe) => {
    const next = new Set(fixed)
    if (next.has(vibe)) next.delete(vibe)
    else next.add(vibe)
    apply(next, new Set([vibe]))
  }

  if (!open) {
    return (
      <button type="button" style={collapsedBtn} onClick={() => setOpen(true)}>
        Scenario
      </button>
    )
  }

  const allFixed = VIBES.every((v) => fixed.has(v))
  const allBroken = fixed.size === 0

  return (
    <div style={panel} role="dialog" aria-label="Tidewell scenario">
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
          <strong style={{ fontSize: 14, fontWeight: 600 }}>Scenario</strong>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#666' }}
          >
            Close
          </button>
        </div>
        <p style={{ margin: '0 0 12px', color: '#333', fontSize: 14 }}>
          Tidewell is made up. Every flaw on it is real.
        </p>

        <div style={seg}>
          <button type="button" style={segBtn(allBroken)} onClick={() => setAll('broken')}>
            As the agent shipped it
          </button>
          <button type="button" style={segBtn(allFixed)} onClick={() => setAll('fixed')}>
            With reference fixes
          </button>
        </div>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#666' }}>
          Reference fix (not your agent&apos;s) when Fixed.
          {serializeFixed(fixed) ? ` fixed=${serializeFixed(fixed)}` : ' (all broken)'}
        </p>

        {VIBES.map((vibe) => {
          const on = isVibeFixed(fixed, vibe)
          const needsReload = RELOAD_VIBES.has(vibe)
          const isOpen = expanded === vibe
          return (
            <div key={vibe}>
              <div style={toggleRow}>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : vibe)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: 0,
                    fontSize: 14,
                    color: '#111',
                    flex: 1,
                  }}
                >
                  {VIBE_LABELS[vibe]}
                  {needsReload ? (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 11,
                        color: '#666',
                        border: '1px solid #ddd',
                        padding: '1px 5px',
                      }}
                    >
                      applies on reload
                    </span>
                  ) : null}
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    style={segBtn(!on)}
                    onClick={() => {
                      if (on) toggleVibe(vibe)
                    }}
                  >
                    Broken
                  </button>
                  <button
                    type="button"
                    style={segBtn(on)}
                    onClick={() => {
                      if (!on) toggleVibe(vibe)
                    }}
                  >
                    Fixed
                  </button>
                </div>
              </div>
              {isOpen ? (
                <ul style={{ margin: '0 0 8px', paddingLeft: 18, color: '#555', fontSize: 12 }}>
                  {VIBE_FAULTS[vibe].map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })}

        {reloadPending ? (
          <button
            type="button"
            onClick={() => {
              setScenarioFixed(fixed)
              window.location.reload()
            }}
            style={{
              marginTop: 12,
              width: '100%',
              height: 40,
              background: '#111',
              color: '#fff',
              border: 'none',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Reload now
          </button>
        ) : null}
      </div>
    </div>
  )
}
