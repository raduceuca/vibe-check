// Components
export { VibeCheck } from './VibeCheck.js'
export type { VibeCheckProps } from './VibeCheck.js'
export { PerfToggle } from './PerfToggle.js'
export type { PerfToggleProps } from './PerfToggle.js'

// Context
export { VibeCheckProvider, useVibeCheckEngine } from './context.js'

// Hooks
export { useVibeCheck } from './hooks/useVibeCheck.js'
export { useFrameRate } from './hooks/useFrameRate.js'
export { useLongFrames } from './hooks/useLongFrames.js'
export { useWebVitals } from './hooks/useWebVitals.js'
export { useMemory } from './hooks/useMemory.js'
export { useDetectedIssues } from './hooks/useDetectedIssues.js'
export { useIssueStore } from './hooks/useIssueStore.js'
export { usePreferences } from './hooks/usePreferences.js'
export { useClipboard } from './hooks/useClipboard.js'

// Store
export type { TrackedIssue, IssueStatus, IssueStore } from './store/issueStore.js'
export type { VibeCheckPreferences } from './store/preferences.js'

// Re-export commonly needed types from core
export type {
  VibeSnapshot,
  VibeIssue,
  FrameRateStats,
  WebVitalsStats,
  HeapMemory,
  Severity,
  SuggestionMode,
  Suggestion,
  ProactivePrompt,
} from '@wcgw/vibe-check-core'
