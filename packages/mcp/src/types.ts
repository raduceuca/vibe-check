export type Severity = 'info' | 'warning' | 'error' | 'critical'

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
  | 'heavy-library'

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

export interface FrameRate {
  readonly fps: number
  readonly avgFrameTime: number
  readonly maxFrameTime: number
  readonly droppedFrames: number
  readonly smoothness: number
}

export interface LongFrames {
  readonly count: number
  readonly entries: readonly unknown[]
  readonly worstFrame: number
}

export interface WebVitalEntry {
  readonly value: number
  readonly rating: string
}

export interface WebVitals {
  readonly lcp: WebVitalEntry | null
  readonly inp: WebVitalEntry | null
  readonly cls: WebVitalEntry | null
}

export interface MemoryInfo {
  readonly jsHeapSizeMB: number
  readonly totalHeapSizeMB: number
  readonly usedPct: number
}

export interface ResourceInfo {
  readonly totalTransferKB: number
  readonly jsTransferKB: number
  readonly cssTransferKB: number
  readonly imageTransferKB: number
  readonly fontTransferKB: number
  readonly resourceCount: number
  readonly largeResources: readonly unknown[]
}

export interface ConsoleStats {
  readonly logCount: number
  readonly warnCount: number
  readonly errorCount: number
  readonly totalCount: number
}

export interface VibeSnapshot {
  readonly timestamp: number
  readonly frameRate: FrameRate
  readonly longFrames: LongFrames
  readonly webVitals: WebVitals
  readonly memory: MemoryInfo | null
  readonly resources: ResourceInfo
  readonly console: ConsoleStats
  readonly issues: readonly VibeIssue[]
  readonly domNodeCount: number
}
