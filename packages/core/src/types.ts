// Severity levels
export type Severity = 'info' | 'warning' | 'error' | 'critical'

// Detector names
export type DetectorName =
  | 'dom-bloat'
  | 'duplicate-requests'
  | 'console-spam'
  | 'memory-leak'
  | 'layout-thrashing'
  | 'unoptimized-images'
  | 'large-images'
  | 'long-task-attribution'
  | 'resource-bloat'
  | 'web-essentials'

// A detected performance issue
export interface VibeIssue {
  readonly id: string
  readonly detector: DetectorName
  readonly severity: Severity
  readonly title: string
  readonly description: string
  readonly evidence: Record<string, unknown>
  readonly timestamp: number
  readonly acknowledged: boolean
  readonly resolved: boolean
}

// Frame rate stats (from existing useFrameRate)
export interface FrameRateStats {
  readonly fps: number
  readonly avgFrameTime: number
  readonly maxFrameTime: number
  readonly droppedFrames: number
  readonly smoothness: number
}

// Long animation frame entry
export interface LongFrameEntry {
  readonly duration: number
  readonly startTime: number
  readonly blockingDuration: number
  readonly scripts: readonly ScriptAttribution[]
}

export interface ScriptAttribution {
  readonly sourceURL: string
  readonly sourceFunctionName: string
  readonly duration: number
}

// Web Vitals
export type VitalRating = 'good' | 'needs-improvement' | 'poor'

export interface WebVitalsStats {
  readonly lcp: { readonly value: number; readonly rating: VitalRating } | null
  readonly inp: { readonly value: number; readonly rating: VitalRating } | null
  readonly cls: { readonly value: number; readonly rating: VitalRating } | null
}

// Heap memory
export interface HeapMemory {
  readonly jsHeapSizeMB: number
  readonly totalHeapSizeMB: number
  readonly usedPct: number
}

// Resource stats
export interface ResourceStats {
  readonly totalTransferKB: number
  readonly jsTransferKB: number
  readonly cssTransferKB: number
  readonly imageTransferKB: number
  readonly fontTransferKB: number
  readonly resourceCount: number
  readonly largeResources: readonly LargeResource[]
}

export interface LargeResource {
  readonly url: string
  readonly transferSizeKB: number
  readonly type: string
}

// Long frame stats
export interface LongFrameStats {
  readonly count: number
  readonly entries: readonly LongFrameEntry[]
  readonly worstFrame: number
}

// Console stats
export interface ConsoleStats {
  readonly logCount: number
  readonly warnCount: number
  readonly errorCount: number
  readonly totalCount: number
}

// Complete snapshot
export interface VibeSnapshot {
  readonly timestamp: number
  readonly frameRate: FrameRateStats
  readonly longFrames: LongFrameStats
  readonly webVitals: WebVitalsStats
  readonly memory: HeapMemory | null
  readonly resources: ResourceStats
  readonly console: ConsoleStats
  readonly issues: readonly VibeIssue[]
  readonly domNodeCount: number
}

// Empty defaults
export const EMPTY_FRAME_RATE_STATS: FrameRateStats = {
  fps: 0,
  avgFrameTime: 0,
  maxFrameTime: 0,
  droppedFrames: 0,
  smoothness: 100,
}

export const EMPTY_LONG_FRAME_STATS: LongFrameStats = {
  count: 0,
  entries: [],
  worstFrame: 0,
}

export const EMPTY_WEB_VITALS: WebVitalsStats = {
  lcp: null,
  inp: null,
  cls: null,
}

export const EMPTY_CONSOLE_STATS: ConsoleStats = {
  logCount: 0,
  warnCount: 0,
  errorCount: 0,
  totalCount: 0,
}

export const EMPTY_RESOURCE_STATS: ResourceStats = {
  totalTransferKB: 0,
  jsTransferKB: 0,
  cssTransferKB: 0,
  imageTransferKB: 0,
  fontTransferKB: 0,
  resourceCount: 0,
  largeResources: [],
}

// Collector interface
export interface Collector<T> {
  start(): void
  stop(): void
  getStats(): T
  onUpdate(callback: (stats: T) => void): () => void
}

// Detector interface
export interface Detector {
  readonly name: DetectorName
  start(): void
  stop(): void
  getIssues(): readonly VibeIssue[]
  clear(): void
}

// Engine config
export interface VibeCheckConfig {
  readonly enabled: boolean
  readonly beaconUrl?: string
  readonly beaconIntervalMs: number
  readonly detectors: {
    readonly domBloat: boolean
    readonly duplicateRequests: boolean
    readonly consoleSpam: boolean
    readonly memoryLeak: boolean
    readonly layoutThrashing: boolean
    readonly unoptimizedImages: boolean
    readonly longTaskAttribution: boolean
    readonly resourceBloat: boolean
    readonly largeImages: boolean
    readonly webEssentials: boolean
  }
}

export const DEFAULT_CONFIG: VibeCheckConfig = {
  enabled: true,
  beaconIntervalMs: 2000,
  detectors: {
    domBloat: true,
    duplicateRequests: true,
    consoleSpam: true,
    memoryLeak: true,
    layoutThrashing: true,
    unoptimizedImages: true,
    longTaskAttribution: true,
    resourceBloat: true,
    largeImages: true,
    webEssentials: true,
  },
}
