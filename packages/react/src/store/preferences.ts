import type { SuggestionMode } from '@wcgw/vibe-check-core'

// ── Types ───────────────────────────────────────────────���───────────────────

export type VibeCheckTheme = 'dark' | 'light'

export interface VibeCheckPreferences {
  readonly mode: SuggestionMode
  readonly annotationsVisible: boolean
  readonly clearOnSend: boolean
  readonly theme: VibeCheckTheme
  // Persist the FPS history to localStorage so the performance lifeline survives
  // reloads instead of starting blank each time.
  readonly keepHistory: boolean
}

// ── Storage ────────────────────────────────���────────────────────────────────

// Default localStorage key. Pass a distinct `storageKey` per widget instance
// (e.g. multiple landing-page embeds) so they don't collide on one bucket.
export const DEFAULT_PREFERENCES_KEY = 'vibe-check:preferences'

const DEFAULTS: VibeCheckPreferences = {
  mode: 'vibe',
  annotationsVisible: true,
  clearOnSend: false,
  theme: 'dark',
  keepHistory: true,
}

export const readPreferences = (storageKey: string = DEFAULT_PREFERENCES_KEY): VibeCheckPreferences => {
  try {
    if (typeof localStorage === 'undefined') return DEFAULTS
    const raw = localStorage.getItem(storageKey)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<VibeCheckPreferences>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

export const writePreferences = (prefs: VibeCheckPreferences, storageKey: string = DEFAULT_PREFERENCES_KEY): void => {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(storageKey, JSON.stringify(prefs))
  } catch {
    // Storage unavailable
  }
}
