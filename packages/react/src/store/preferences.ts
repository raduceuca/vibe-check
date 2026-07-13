import type { SuggestionMode } from '@wcgw/vibe-check-core'
import type { Position } from '../panels/types.js'

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
  readonly collapsed: boolean
  readonly positionsLinked: boolean
  readonly collapsedPosition: Position | null
  readonly expandedPosition: Position | null
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
  collapsed: false,
  positionsLinked: true,
  collapsedPosition: null,
  expandedPosition: null,
}

const POSITIONS: readonly Position[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
]

const isPosition = (value: unknown): value is Position =>
  POSITIONS.includes(value as Position)

export const resolvePreferencesKey = (
  storageKey?: string,
  projectId?: string,
): string => storageKey ?? (projectId
  ? `${DEFAULT_PREFERENCES_KEY}:${encodeURIComponent(projectId)}`
  : DEFAULT_PREFERENCES_KEY)

export const readPreferences = (
  storageKey: string = DEFAULT_PREFERENCES_KEY,
  firstUseCollapsed = false,
): VibeCheckPreferences => {
  const defaults: VibeCheckPreferences = { ...DEFAULTS, collapsed: firstUseCollapsed }
  try {
    if (typeof localStorage === 'undefined') return defaults
    const raw = localStorage.getItem(storageKey)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<VibeCheckPreferences>
    return {
      mode: parsed.mode === 'technical' || parsed.mode === 'vibe' ? parsed.mode : defaults.mode,
      annotationsVisible: typeof parsed.annotationsVisible === 'boolean'
        ? parsed.annotationsVisible
        : defaults.annotationsVisible,
      clearOnSend: typeof parsed.clearOnSend === 'boolean' ? parsed.clearOnSend : defaults.clearOnSend,
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : defaults.theme,
      keepHistory: typeof parsed.keepHistory === 'boolean' ? parsed.keepHistory : defaults.keepHistory,
      collapsed: typeof parsed.collapsed === 'boolean' ? parsed.collapsed : firstUseCollapsed,
      positionsLinked: typeof parsed.positionsLinked === 'boolean' ? parsed.positionsLinked : true,
      collapsedPosition: isPosition(parsed.collapsedPosition) ? parsed.collapsedPosition : null,
      expandedPosition: isPosition(parsed.expandedPosition) ? parsed.expandedPosition : null,
    }
  } catch {
    return defaults
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
