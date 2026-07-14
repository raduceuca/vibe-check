import { useState, useCallback, useEffect } from 'react'
import type { SuggestionMode } from '@wcgw/vibe-check-core'
import { readPreferences, resolvePreferencesKey, writePreferences } from '../store/preferences.js'
import type { VibeCheckPreferences } from '../store/preferences.js'

// `storageKey` lets callers own a preference bucket. Without one, `projectId`
// isolates widgets from independent local projects.
export const usePreferences = (
  storageKey?: string,
  projectId?: string,
  startCollapsed = false,
) => {
  const resolvedKey = resolvePreferencesKey(storageKey, projectId)
  const [prefs, setPrefs] = useState<VibeCheckPreferences>(
    () => readPreferences(resolvedKey, startCollapsed),
  )

  useEffect(() => {
    setPrefs(readPreferences(resolvedKey, startCollapsed))
  }, [resolvedKey, startCollapsed])

  const updatePrefs = useCallback((updates: Partial<VibeCheckPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...updates }
      writePreferences(next, resolvedKey)
      return next
    })
  }, [resolvedKey])

  const toggleMode = useCallback(() => {
    setPrefs((prev) => {
      const next: VibeCheckPreferences = {
        ...prev,
        mode: prev.mode === 'technical' ? 'vibe' as SuggestionMode : 'technical' as SuggestionMode,
      }
      writePreferences(next, resolvedKey)
      return next
    })
  }, [resolvedKey])

  return { prefs, updatePrefs, toggleMode }
}
