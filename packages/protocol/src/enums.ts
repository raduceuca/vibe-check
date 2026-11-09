// Leaf module: runtime enum arrays with no imports. index.ts derives the types
// from these arrays and re-exports them; the helper modules (payload, catalog,
// verification) import from here instead of from index.ts so the bundle has no
// runtime import cycle.

export const SEVERITIES = ['info', 'warning', 'error', 'critical'] as const

export const DETECTOR_NAMES = [
  'dom-bloat',
  'duplicate-requests',
  'console-spam',
  'memory-leak',
  'layout-thrashing',
  'unoptimized-images',
  'large-images',
  'long-task-attribution',
  'resource-bloat',
  'web-essentials',
  'heavy-library',
  'seo',
  'aeo',
] as const

// The detectors that run a discrete audit (a set of checks plus network probes)
// instead of observing the page continuously. Their absence-evidence only
// counts once a run has finished after the moment in question.
export const AUDIT_DETECTORS = ['seo', 'aeo', 'web-essentials'] as const
