// VIBECHECK-FAULT: fps (collector) — setState every 50ms
import { useEffect, useState } from 'react'
import { mute, section } from './styles'

export const StockTicker = () => {
  const [n, setN] = useState(7)

  useEffect(() => {
    const id = window.setInterval(() => {
      setN((prev) => (prev <= 1 ? 12 : prev - 1))
    }, 50)
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
