// VIBECHECK-FAULT: large-images
// VIBECHECK-FAULT: unoptimized-images
export const Hero = ({ findableFixed = false }: { readonly findableFixed?: boolean }) => (
  <section className="hero" aria-labelledby="hero-h">
    {/* Broken: oversized hero (~2.4 MB) with no dimensions / srcset */}
    <img
      src="/images/hero-4000.jpg"
      {...(findableFixed
        ? { alt: 'Tidewell studio shelf of glazed mugs' }
        : { alt: '' })}
      {...(findableFixed ? {} : {})}
      style={findableFixed ? undefined : { width: '100%', height: '100%', objectFit: 'cover' }}
    />
    <div className="hero-tx">
      <p>Spring glazes</p>
      <h1 id="hero-h">Mugs that hold the heat.</h1>
      <a className="btn light" href={findableFixed ? '#shop' : '#'}>
        Shop the spring glazes
      </a>
    </div>
  </section>
)
