import { useState } from 'react'

export const Newsletter = ({ findableFixed = false }: { readonly findableFixed?: boolean }) => {
  const [email, setEmail] = useState('')

  return (
    <section className="news" id="newsletter" aria-labelledby="news-h">
      <div className="split-img">
        <img
          src="/shop-assets/img/newsletter-960.webp"
          srcSet="/shop-assets/img/newsletter-480.webp 480w, /shop-assets/img/newsletter-960.webp 960w, /shop-assets/img/newsletter-1600.webp 1600w"
          sizes="(max-width: 900px) 100vw, 50vw"
          width={896}
          height={1152}
          alt=""
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="news-tx">
        <h2 id="news-h">Get the kiln schedule</h2>
        <p style={{ color: 'var(--muted)', margin: '0 0 20px' }}>
          Firing dates, glaze drops, and open studio hours — a few notes a month.
        </p>
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault()
            setEmail('')
          }}
        >
          <input
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            style={{
              width: '100%',
              minHeight: 46,
              border: '1px solid var(--line)',
              padding: '0 12px',
              background: '#fff',
            }}
          />
          <button type="submit" className="btn">
            {findableFixed ? 'Join the list' : 'Click here'}
          </button>
        </form>
      </div>
    </section>
  )
}
