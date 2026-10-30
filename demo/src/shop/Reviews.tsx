// VIBECHECK-FAULT: dom-bloat
import { HARBOR_REVIEWS } from './data/reviews'
import { h2, section, ink, mute, soft, serif } from './styles'

export const Reviews = () => (
    <section style={section}>
      <h2 style={h2}>What people say about the Harbor mug</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {HARBOR_REVIEWS.map((r) => (
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
    </section>
)
