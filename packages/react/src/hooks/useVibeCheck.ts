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

// Cheap shallow equality over the small, flat VibeCheckConfig shape. Replaces
// per-render JSON.stringify which serialized the entire config plus any
// nested `detectors` object on every render.
const shallowConfigEqual = (
  a: Partial<VibeCheckConfig> | undefined,
  b: Partial<VibeCheckConfig> | undefined,
): boolean => {
  if (a === b) return true
  if (!a || !b) return false
  const aKeys = Object.keys(a) as (keyof VibeCheckConfig)[]
  const bKeys = Object.keys(b) as (keyof VibeCheckConfig)[]
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) {
    const av = a[k]
    const bv = b[k]
    if (av === bv) continue
    if (k === 'detectors' && av && bv && typeof av === 'object' && typeof bv === 'object') {
      const avKeys = Object.keys(av)
      const bvKeys = Object.keys(bv)
      if (avKeys.length !== bvKeys.length) return false
      for (const dk of avKeys) {
        if ((av as Record<string, unknown>)[dk] !== (bv as Record<string, unknown>)[dk]) return false
      }
      continue
    }
    return false
  }
  return true
}

export const useVibeCheck = (
  config?: Partial<VibeCheckConfig>,
  enabled = true
): UseVibeCheckResult => {
  const engineRef = useRef<VibeCheckEngine | null>(null)
  const [snapshot, setSnapshot] = useState<VibeSnapshot>(EMPTY_SNAPSHOT)

  // Keep a stable reference to the config until it meaningfully changes.
  const stableConfigRef = useRef<Partial<VibeCheckConfig> | undefined>(config)
  const stableConfig = useMemo(() => {
    if (!shallowConfigEqual(stableConfigRef.current, config)) {
      stableConfigRef.current = config
    }
    return stableConfigRef.current
  }, [config])

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

    const engine = new VibeCheckEngine(stableConfig ?? {})
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
  }, [enabled, stableConfig])

  return { engine: engineRef.current, snapshot }
}
