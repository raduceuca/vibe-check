import { useRef, useEffect, useState, useMemo } from 'react'
import {
  VibeCheckEngine,
  type VibeCheckConfig,
  type VibeSnapshot,
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
} from '@wcgw/vibe-check-core'

const EMPTY_SNAPSHOT: VibeSnapshot = {
  timestamp: 0,
  frameRate: EMPTY_FRAME_RATE_STATS,
  longFrames: EMPTY_LONG_FRAME_STATS,
  webVitals: EMPTY_WEB_VITALS,
  memory: null,
  resources: EMPTY_RESOURCE_STATS,
  console: EMPTY_CONSOLE_STATS,
  issues: [],
  domNodeCount: 0,
}

interface UseVibeCheckResult {
  readonly engine: VibeCheckEngine | null
  readonly snapshot: VibeSnapshot
}

export const useVibeCheck = (
  config?: Partial<VibeCheckConfig>,
  enabled = true
): UseVibeCheckResult => {
  const engineRef = useRef<VibeCheckEngine | null>(null)
  const [snapshot, setSnapshot] = useState<VibeSnapshot>(EMPTY_SNAPSHOT)

  // Stable config reference — serialize to detect changes
  const configKey = useMemo(() => JSON.stringify(config ?? {}), [config])

  useEffect(() => {
    if (!enabled) {
      // Stop any existing engine when disabled
      if (engineRef.current) {
        engineRef.current.stop()
        engineRef.current = null
      }
      setSnapshot(EMPTY_SNAPSHOT)
      return
    }

    const parsedConfig: Partial<VibeCheckConfig> = JSON.parse(configKey)
    const engine = new VibeCheckEngine(parsedConfig)
    engineRef.current = engine

    const unsubscribe = engine.onSnapshot((s) => {
      setSnapshot(s)
    })

    engine.start()

    return () => {
      unsubscribe()
      engine.stop()
      engineRef.current = null
    }
  }, [enabled, configKey])

  return { engine: engineRef.current, snapshot }
}
