'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { VibeEngine, VibeSnapshot } from '@wcgw/vibe-check-core'
import { VibeWidget } from '@/components/vibe/VibeWidget'
import { WidgetLayoutSync } from '@/components/vibe/WidgetLayoutSync'

interface LiveEngineValue {
  readonly engine: VibeEngine | null
  readonly ready: boolean
  readonly subscribe: (listener: (snapshot: VibeSnapshot) => void) => () => void
  readonly getSnapshot: () => VibeSnapshot | null
}

const LiveEngineContext = createContext<LiveEngineValue | null>(null)

const EMPTY: LiveEngineValue = {
  engine: null,
  ready: false,
  subscribe: () => () => undefined,
  getSnapshot: () => null,
}

export const useLiveEngine = (): LiveEngineValue =>
  useContext(LiveEngineContext) ?? EMPTY

export const LiveEngineProvider = ({ children }: { readonly children: ReactNode }) => {
  const [engine, setEngine] = useState<VibeEngine | null>(null)

  useEffect(() => {
    let cancelled = false
    let active: VibeEngine | null = null
    let stopPageHide: (() => void) | undefined

    void import('@wcgw/vibe-check-core').then(({ VibeCheckEngine }) => {
      if (cancelled) return
      const instance = new VibeCheckEngine({})
      instance.start()
      active = instance
      setEngine(instance)

      const onPageHide = () => { instance.stop() }
      window.addEventListener('pagehide', onPageHide)
      stopPageHide = () => window.removeEventListener('pagehide', onPageHide)
    })

    return () => {
      cancelled = true
      stopPageHide?.()
      active?.stop()
      setEngine(null)
    }
  }, [])

  const value = useMemo<LiveEngineValue>(() => ({
    engine,
    ready: engine !== null,
    subscribe: (listener) => {
      if (!engine) return () => undefined
      return engine.onSnapshot(listener)
    },
    getSnapshot: () => engine?.getSnapshot() ?? null,
  }), [engine])

  return (
    <LiveEngineContext.Provider value={value}>
      {engine ? (
        <VibeWidget
          engine={engine}
          storageKey="vibecheck-site"
          position="bottom-right"
        />
      ) : null}
      <WidgetLayoutSync />
      {children}
    </LiveEngineContext.Provider>
  )
}
