// ════════════════════════════════════════════════════════════════════════════
// @wcgw/vibe-check-protocol
//
// The single source of truth for the vibe-check wire contract: the snapshot that
// the browser core produces and POSTs to the MCP server, the issue shape, the
// detector/severity enums, and the per-detector evidence shapes.
//
// This package is INTERNAL: it has zero runtime dependencies and is bundled into
// each published package (core, react, mcp) by tsup rather than shipped on its
// own. core imports it type-only (so its zero-runtime-deps promise holds); mcp
// also imports the DETECTOR_NAMES / SEVERITIES const arrays to build its zod
// validation schema, single-sourcing the enums.
//
// Why it exists: core and mcp used to hand-mirror these types in two files with
// no compile link, and they drifted — over half the fix-suggestion templates
// read evidence keys the detectors never emit. Deriving DetectorName from the
// DETECTOR_NAMES array (below) and typing both suggestion maps as
// Record<DetectorName, …> makes that class of drift a compile error.
// ════════════════════════════════════════════════════════════════════════════

// ── Enums (type + runtime list derived from one source) ─────────────────────

export const SEVERITIES = ['info', 'warning', 'error', 'critical'] as const
export type Severity = (typeof SEVERITIES)[number]

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
] as const
export type DetectorName = (typeof DETECTOR_NAMES)[number]

// ── Issue ───────────────────────────────────────────────────────────────────

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

// ── Per-detector evidence contract ──────────────────────────────────────────
// Ground-truth keys, matching exactly what each detector's createIssue() emits.
// Suggestion templates and validators should read against these so a renamed key
// fails to compile instead of silently rendering "unknown" to the agent.

export interface DomBloatEvidence {
  readonly nodeCount: number
  readonly maxDepth: number
  readonly timestamp: number
}
export interface DuplicateRequestsEvidence {
  readonly url: string
  readonly method: string
  readonly count: number
  readonly windowMs: number
}
export interface ConsoleSpamEvidence {
  readonly method: string
  readonly callCount: number
  readonly windowSeconds: number
  readonly sampleArgs: readonly string[]
}
export interface MemoryLeakEvidence {
  readonly heapGrowthPct: number
  readonly baselineMB: number
  readonly currentMB: number
  readonly sampleCount: number
}
export interface LayoutThrashingEvidence {
  readonly shiftCount: number
  readonly totalShiftValue: number
  readonly clusterDurationMs: number
}
export interface UnoptimizedImagesEvidence {
  readonly src: string
  readonly issue: string
}
export interface LargeImagesEvidence {
  readonly src: string
  readonly transferSizeKB: number
  readonly naturalWidth: number
  readonly naturalHeight: number
  readonly renderedWidth: number
  readonly renderedHeight: number
  readonly format: string
}
export interface LongTaskAttributionEvidence {
  readonly sourceURL: string
  readonly longFrameCount: number
  readonly totalBlockingMs: number
}
export interface ResourceBloatEvidence {
  readonly url: string
  readonly transferSizeKB: number
  readonly type: string
}
export interface WebEssentialsEvidence {
  readonly check: string
}
export interface HeavyLibraryEvidence {
  readonly library: string
  readonly packageName: string
  readonly category: string
  readonly bundleSizeKB: number
  readonly riskLevel: string
  readonly detectedVia: string
  readonly knownIssues: readonly string[]
  readonly vibeDescription: string
}

export interface IssueEvidenceMap {
  readonly 'dom-bloat': DomBloatEvidence
  readonly 'duplicate-requests': DuplicateRequestsEvidence
  readonly 'console-spam': ConsoleSpamEvidence
  readonly 'memory-leak': MemoryLeakEvidence
  readonly 'layout-thrashing': LayoutThrashingEvidence
  readonly 'unoptimized-images': UnoptimizedImagesEvidence
  readonly 'large-images': LargeImagesEvidence
  readonly 'long-task-attribution': LongTaskAttributionEvidence
  readonly 'resource-bloat': ResourceBloatEvidence
  readonly 'web-essentials': WebEssentialsEvidence
  readonly 'heavy-library': HeavyLibraryEvidence
}

export type EvidenceFor<D extends DetectorName> = IssueEvidenceMap[D]

// ── Collector / metric stats (snapshot sub-shapes) ──────────────────────────

export interface FrameRateStats {
  readonly fps: number
  readonly avgFrameTime: number
  readonly maxFrameTime: number
  readonly droppedFrames: number
  readonly smoothness: number
}

export interface ScriptAttribution {
  readonly sourceURL: string
  readonly sourceFunctionName: string
  readonly duration: number
}

export interface LongFrameEntry {
  readonly duration: number
  readonly startTime: number
  readonly blockingDuration: number
  readonly scripts: readonly ScriptAttribution[]
}

export interface LongFrameStats {
  readonly count: number
  readonly entries: readonly LongFrameEntry[]
  readonly worstFrame: number
}

export type VitalRating = 'good' | 'needs-improvement' | 'poor'

export interface WebVitalEntry {
  readonly value: number
  readonly rating: VitalRating
}

export interface WebVitalsStats {
  readonly lcp: WebVitalEntry | null
  readonly inp: WebVitalEntry | null
  readonly cls: WebVitalEntry | null
}

export interface HeapMemory {
  readonly jsHeapSizeMB: number
  readonly totalHeapSizeMB: number
  readonly usedPct: number
}

export interface LargeResource {
  readonly url: string
  readonly transferSizeKB: number
  readonly type: string
}

export interface ResourceStats {
  readonly totalTransferKB: number
  readonly jsTransferKB: number
  readonly cssTransferKB: number
  readonly imageTransferKB: number
  readonly fontTransferKB: number
  readonly resourceCount: number
  readonly largeResources: readonly LargeResource[]
}

export interface ConsoleStats {
  readonly logCount: number
  readonly warnCount: number
  readonly errorCount: number
  readonly totalCount: number
}

// ── Snapshot (the wire payload) ─────────────────────────────────────────────

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

// ── Collector / Detector contracts (extension points) ───────────────────────

export interface Collector<T> {
  start(): void
  stop(): void
  getStats(): T
  onUpdate(callback: (stats: T) => void): () => void
}

export interface Detector {
  readonly name: DetectorName
  start(): void
  stop(): void
  getIssues(): readonly VibeIssue[]
  clear(): void
}
