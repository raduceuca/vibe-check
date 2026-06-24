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

const STORAGE_KEY = 'vibe-check:preferences'

const DEFAULTS: VibeCheckPreferences = {
  mode: 'vibe',
  annotationsVisible: true,
  clearOnSend: false,
  theme: 'dark',
  keepHistory: true,
}

export const readPreferences = (): VibeCheckPreferences => {
  try {
    if (typeof localStorage === 'undefined') return DEFAULTS
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Partial<VibeCheckPreferences>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return DEFAULTS
  }
}

export const writePreferences = (prefs: VibeCheckPreferences): void => {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable
  }
}
