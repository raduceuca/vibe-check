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

// Re-export commonly needed types from core
export type {
  VibeSnapshot,
  VibeIssue,
  FrameRateStats,
  WebVitalsStats,
  HeapMemory,
  Severity,
} from '@wcgw/vibe-check-core'
