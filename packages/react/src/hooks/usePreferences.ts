import { useState, useCallback } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { readPreferences, writePreferences } from '../store/preferences.js'
import type { VibeCheckPreferences } from '../store/preferences.js'

// `storageKey` lets multiple widget instances keep separate preference buckets.
export const usePreferences = (storageKey?: string) => {
  const [prefs, setPrefs] = useState<VibeCheckPreferences>(() => readPreferences(storageKey))

  const updatePrefs = useCallback((updates: Partial<VibeCheckPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates }
      writePreferences(next, storageKey)
      return next
    })
  }, [storageKey])

  const toggleMode = useCallback(() => {
    setPrefs((prev) => {
      const next: VibeCheckPreferences = {
        ...prev,
        mode: prev.mode === 'technical' ? 'vibe' as SuggestionMode : 'technical' as SuggestionMode,
      }
      writePreferences(next, storageKey)
      return next
    })
  }, [storageKey])

  return { prefs, updatePrefs, toggleMode }
}
