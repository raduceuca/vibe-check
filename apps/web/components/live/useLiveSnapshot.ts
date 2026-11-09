'use client'

import { useSyncExternalStore } from 'react'
import type { VibeSnapshot } from '@wcgw/vibe-check-core'
import { useLiveEngine } from './LiveEngineProvider'

const serverSnapshot = (): VibeSnapshot | null => null

export const useLiveSnapshot = (): VibeSnapshot | null => {
  const { subscribe, getSnapshot } = useLiveEngine()
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)
}
