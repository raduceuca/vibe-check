/** Reference fix: srcset, dimensions, loading=lazy. */
import { PRODUCTS } from '../data/products'
import { ShipsBy } from './ShipsBy'

export const ProductGrid = ({
  findableFixed = true,
}: {
  readonly findableFixed?: boolean
}) => (
  <>
    <div className="row-head" id="shop">
      <h2>Spring glazes</h2>
      <a className="link" href="#shop">
        View all
      </a>
    </div>
    <div className="grid">
      {PRODUCTS.map((p, i) => {
        const n = i + 1
        return (
          <article key={p.id} className="card" data-i={i}>
            <div className="ph">
              <img
                src={`/images/product-${n}.jpg`}
                srcSet={`/images/product-${n}-sm.jpg 560w, /images/product-${n}.jpg 1600w`}
                sizes="(max-width: 900px) 50vw, 25vw"
                width={280}
                height={350}
                loading="lazy"
                decoding="async"
                alt={findableFixed ? `${p.name} in ${p.glaze}` : ''}
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
        )
      })}
    </div>
  </>
)
