/** Reference fix: silent poll every 60 s. */
import { useEffect, useRef } from 'react'

export const CartPoller = () => {
  const last = useRef(0)

  useEffect(() => {
    const tick = () => {
      last.current = Date.now()
      void fetch('/api/cart.json').catch(() => undefined)
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return null
}
