/** Reference fix: update once a minute, local state. */
import { useEffect, useState } from 'react'
import { mute, section } from '../styles'

export const StockTicker = () => {
  const [n, setN] = useState(7)

  useEffect(() => {
    const id = window.setInterval(() => {
      setN((prev) => (prev <= 1 ? 12 : prev - 1))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <section style={{ ...section, paddingTop: 8, paddingBottom: 8 }}>
      <p style={{ margin: 0, color: mute, fontSize: 14 }}>
        Only {n} left in Tide Blue
      </p>
    </section>
  )
}
