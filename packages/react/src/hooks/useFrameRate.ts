import { useState, useEffect, useRef } from 'react'
import {
  FrameRateCollector,
  EMPTY_FRAME_RATE_STATS,
  type FrameRateStats,
} from '@wcgw/vibe-check-core'

export const useFrameRate = (enabled = false): FrameRateStats => {
  const collectorRef = useRef<FrameRateCollector | null>(null)
  const [stats, setStats] = useState<FrameRateStats>(EMPTY_FRAME_RATE_STATS)

  useEffect(() => {
    if (!enabled) {
      if (collectorRef.current) {
        collectorRef.current.stop()
        collectorRef.current = null
      }
      setStats(EMPTY_FRAME_RATE_STATS)
      return
    }

    const collector = new FrameRateCollector()
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
