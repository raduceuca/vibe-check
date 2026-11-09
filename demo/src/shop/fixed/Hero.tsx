/** Reference fix: sized hero with srcset, dimensions, reserved space. */
export const Hero = ({ findableFixed = true }: { readonly findableFixed?: boolean }) => (
  <section className="hero" aria-labelledby="hero-h">
    <img
      src="/shop-assets/img/hero-960.webp"
      srcSet="/shop-assets/img/hero-480.webp 480w, /shop-assets/img/hero-960.webp 960w, /shop-assets/img/hero-1600.webp 1600w"
      sizes="100vw"
      width={1344}
      height={768}
      alt={findableFixed ? 'Tidewell studio — spring glaze firing' : ''}
      fetchPriority="high"
    />
    <div className="hero-tx">
      <p>Spring glazes</p>
      <h1 id="hero-h">Mugs that hold the heat.</h1>
      <a className="btn light" href="#shop">
        Shop the spring glazes
      </a>
    </div>
  </section>
)
