// VIBECHECK-FAULT: duplicate-requests
import { useEffect, useState } from 'react'
import { fetchCartUncached, type CartPayload } from './cartApi'
import { ink, mute } from './styles'

export const MiniCart = () => {
  const [cart, setCart] = useState<CartPayload | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchCartUncached()
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
