// VIBECHECK-FAULT: resource-bloat
import { useMemo, useState } from 'react'
import catalog from './data/catalog-full.json'
import { ink, mute } from './styles'

interface CatalogProduct {
  readonly id: string
  readonly name: string
  readonly glaze: string
  readonly shape: string
}

interface CatalogFile {
  readonly products: readonly CatalogProduct[]
}

const data = catalog as CatalogFile

export const ProductSearch = () => {
  const [q, setQ] = useState('')

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (needle.length < 2) return []
    return data.products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.glaze.toLowerCase().includes(needle) ||
          p.shape.toLowerCase().includes(needle),
      )
      .slice(0, 8)
  }, [q])

  return (
    <div style={{ position: 'relative', minWidth: 180 }}>
      <label style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        Search the catalog
      </label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        style={{
          border: '1px solid #ddd',
          padding: '8px 10px',
          fontSize: 14,
          color: ink,
          width: '100%',
          background: '#fff',
        }}
      />
      {hits.length > 0 ? (
        <ul
          style={{
            position: 'absolute',
            zIndex: 20,
            top: '100%',
            left: 0,
            right: 0,
            margin: 0,
            padding: 0,
            listStyle: 'none',
            background: '#fff',
            border: '1px solid #ddd',
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {hits.map((p) => (
            <li key={p.id} style={{ padding: '8px 10px', fontSize: 13, color: mute, borderBottom: '1px solid #f0f0f0' }}>
              {p.name}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
