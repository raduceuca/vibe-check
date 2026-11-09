/** Reference fix: windowed list of 20 with Show more — no virtualization dependency. */
import { useState } from 'react'
import { HARBOR_REVIEWS } from '../data/reviews'
import { h2, section, ink, mute, soft, serif } from '../styles'

const PAGE = 20

export const Reviews = () => {
  const [visible, setVisible] = useState(PAGE)
  const slice = HARBOR_REVIEWS.slice(0, visible)

  return (
    <section style={section}>
      <h2 style={h2}>What people say about the Harbor mug</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {slice.map((r) => (
          <article
            key={r.id}
            style={{
              padding: '12px 14px',
              background: soft,
              borderBottom: '1px solid #ebebeb',
            }}
          >
            <p style={{ margin: '0 0 4px', fontFamily: serif, color: ink, fontSize: 16 }}>
              {r.name}
            </p>
            <p style={{ margin: 0, color: mute, fontSize: 14 }}>{r.body}</p>
          </article>
        ))}
      </div>
      {visible < HARBOR_REVIEWS.length ? (
        <button
          type="button"
          onClick={() => setVisible((v) => Math.min(v + PAGE, HARBOR_REVIEWS.length))}
          style={{
            marginTop: 16,
            background: 'transparent',
            border: `1px solid ${ink}`,
            color: ink,
            padding: '10px 16px',
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Show more
        </button>
      ) : null}
    </section>
  )
}
