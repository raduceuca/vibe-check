/** Reference fix: shared cart promise cache. */
import { useEffect, useState } from 'react'
import { fetchCartCached, type CartPayload } from '../cartApi'
import { ink, mute } from '../styles'

export const MiniCart = () => {
  const [cart, setCart] = useState<CartPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchCartCached()
      .then((data) => {
        if (!cancelled) setCart(data)
      })
      .catch(() => {
        if (!cancelled) setCart(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const count = cart?.count ?? '…'
  return (
    <span style={{ color: ink, fontSize: 14 }}>
      Cart <span style={{ color: mute }}>({count})</span>
    </span>
  )
}
