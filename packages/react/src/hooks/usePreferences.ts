import { useState, useCallback } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { readPreferences, writePreferences } from '../store/preferences.js'
import type { VibeCheckPreferences } from '../store/preferences.js'

export const usePreferences = () => {
  const [prefs, setPrefs] = useState<VibeCheckPreferences>(readPreferences)

  const updatePrefs = useCallback((updates: Partial<VibeCheckPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates }
      writePreferences(next)
      return next
    })
  }, [])

  const toggleMode = useCallback(() => {
    setPrefs((prev) => {
      const next: VibeCheckPreferences = {
        ...prev,
        mode: prev.mode === 'technical' ? 'vibe' as SuggestionMode : 'technical' as SuggestionMode,
      }
      writePreferences(next)
      return next
    })
  }, [])

  return { prefs, updatePrefs, toggleMode }
}
