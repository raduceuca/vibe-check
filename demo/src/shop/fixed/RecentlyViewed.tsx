/** Reference fix: RingBuffer(12) + resize listener cleanup. */
import { useEffect, useState } from 'react'
import { RingBuffer } from '@wcgw/vibe-check-core'
import { PRODUCTS } from '../data/products'
import { h2, productName, section, mute } from '../styles'

const recentIds = new RingBuffer<string>(12)

export const RecentlyViewed = () => {
  const [ids, setIds] = useState<readonly string[]>(() => recentIds.toArray())
  const [width, setWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1080,
  )

  useEffect(() => {
    for (const p of PRODUCTS.slice(0, 4)) recentIds.push(p.id)
    setIds(recentIds.toArray())
  }, [])

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const items = ids
    .map((id) => PRODUCTS.find((p) => p.id === id))
    .filter((p): p is (typeof PRODUCTS)[number] => p !== undefined)

  return (
    <section style={section}>
      <h2 style={h2}>Recently viewed</h2>
      <p style={{ color: mute, fontSize: 13, margin: '0 0 16px' }}>
        Last {ids.length} pieces · viewport {width}px
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {items.map((p) => (
          <div key={p.id} style={{ width: 140 }}>
            <img
              src={p.image}
              alt={`${p.name} in ${p.glaze}`}
              width={140}
              height={105}
              loading="lazy"
              style={{ width: 140, height: 105, objectFit: 'cover', display: 'block', marginBottom: 8 }}
            />
            <p style={productName}>{p.name}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
