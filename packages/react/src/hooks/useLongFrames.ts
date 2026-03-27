import { useState, useEffect, useRef } from 'react'
import {
  LongFrameCollector,
  EMPTY_LONG_FRAME_STATS,
  type LongFrameStats,
} from '@wcgw/vibe-check-core'

export const useLongFrames = (enabled = false): LongFrameStats => {
  const collectorRef = useRef<LongFrameCollector | null>(null)
  const [stats, setStats] = useState<LongFrameStats>(EMPTY_LONG_FRAME_STATS)

  useEffect(() => {
    if (!enabled) {
      if (collectorRef.current) {
        collectorRef.current.stop()
        collectorRef.current = null
      }
      setStats(EMPTY_LONG_FRAME_STATS)
      return
    }

    const collector = new LongFrameCollector()
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
