// VIBECHECK-FAULT: dom-bloat
// Classic vibe-coded "SEO dump": paint a tidy 3-review strip, then mount every
// review into a zero-height container so the page still "has" them. Looks fine;
// the DOM is 2,000 articles deep and trips dom-bloat without wrecking scroll.
import { HARBOR_REVIEWS } from './data/reviews'
import { h2, section, ink, mute, soft, softMute, serif } from './styles'

const VISIBLE = 3

export const Reviews = () => {
  const featured = HARBOR_REVIEWS.slice(0, VISIBLE)

  return (
    <section style={{ ...section, position: 'relative' }} aria-labelledby="reviews-h">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 16,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <h2 id="reviews-h" style={{ ...h2, margin: 0 }}>
          What people say about the Harbor mug
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: softMute }}>
          ★★★★☆ · Based on {HARBOR_REVIEWS.length.toLocaleString()} reviews
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {featured.map((r) => (
          <article
            key={r.id}
            style={{
              padding: '12px 14px',
              background: soft,
              borderBottom: `1px solid ${soft}`,
            }}
          >
            <p style={{ margin: '0 0 4px', fontFamily: serif, color: ink, fontSize: 16 }}>
              {r.name}
            </p>
            <p style={{ margin: 0, color: mute, fontSize: 14 }}>{r.body}</p>
          </article>
        ))}
      </div>

      <p style={{ margin: '14px 0 0', fontSize: 13, color: softMute }}>
        Showing {VISIBLE} of {HARBOR_REVIEWS.length.toLocaleString()} ·{' '}
        <span style={{ borderBottom: `1px solid ${softMute}` }}>Read all reviews</span>
      </p>

      {/* Visually collapsed — still fully in the document for querySelectorAll('*'). */}
      <div
        aria-hidden="true"
        data-vibecheck-fault="dom-bloat-seo-dump"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {HARBOR_REVIEWS.map((r) => (
          <article key={`dump-${r.id}`}>
            <p>{r.name}</p>
            <p>{r.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
