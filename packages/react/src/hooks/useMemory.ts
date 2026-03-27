import { useState, useEffect, useRef } from 'react'
import { MemoryCollector, type HeapMemory } from '@wcgw/vibe-check-core'

export const useMemory = (enabled = false): HeapMemory | null => {
  const collectorRef = useRef<MemoryCollector | null>(null)
  const [stats, setStats] = useState<HeapMemory | null>(null)

  useEffect(() => {
    if (!enabled) {
      if (collectorRef.current) {
        collectorRef.current.stop()
        collectorRef.current = null
      }
      setStats(null)
      return
    }

    const collector = new MemoryCollector()
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
