import { useState, useEffect, useRef } from 'react'
import {
  WebVitalsCollector,
  EMPTY_WEB_VITALS,
  type WebVitalsStats,
} from '@wcgw/vibe-check-core'

export const useWebVitals = (enabled = false): WebVitalsStats => {
  const collectorRef = useRef<WebVitalsCollector | null>(null)
  const [stats, setStats] = useState<WebVitalsStats>(EMPTY_WEB_VITALS)

  useEffect(() => {
    if (!enabled) {
      if (collectorRef.current) {
        collectorRef.current.stop()
        collectorRef.current = null
      }
      setStats(EMPTY_WEB_VITALS)
      return
    }

    const collector = new WebVitalsCollector()
    collectorRef.current = collector

    const unsubscribe = collector.onUpdate((s) => {
      setStats(s)
    })

    collector.start()

    return () => {
      unsubscribe()
      collector.stop()
      collectorRef.current = null
    }
  }, [enabled])

  return stats
}
