// VIBECHECK-FAULT: unoptimized-images
import { PRODUCTS } from './data/products'
import { ShipsBy } from './ShipsBy'

export const ProductGrid = ({
  findableFixed = false,
}: {
  readonly findableFixed?: boolean
}) => {
  const Heading = findableFixed ? 'h2' : 'h1'

  return (
    <>
      <div className="row-head" id="shop">
        <Heading>Spring glazes</Heading>
        <a className="link" href="#shop">
          View all
        </a>
      </div>
      <div className="grid">
        {PRODUCTS.map((p, i) => (
          <article
            key={p.id}
            className="card"
            data-i={i}
            data-name={p.name}
            data-cat="glazes"
            data-color={p.glaze}
            data-price={p.price.replace(/\D/g, '')}
          >
            <div className="ph">
              {/* Broken: large source in card, no dims, no lazy */}
              <img
                src={p.image}
                {...(findableFixed ? { alt: `${p.name} in ${p.glaze}` } : { alt: '' })}
              />
              {i === 0 ? <span className="badge">Bestseller</span> : null}
              <button className="quick" type="button">
                Quick add
              </button>
            </div>
            <div className="meta">
              <h3>
                <a href={`#${p.id}`}>{p.name}</a>
              </h3>
              <p className="price" style={{ margin: 0 }}>
                {p.price}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>{p.glaze}</p>
              <ShipsBy date={p.shipsBy} />
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
