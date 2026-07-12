// The wire contract (snapshot, issue, enums, stat shapes, Collector/Detector)
// lives in @wcgw/vibe-check-protocol — the single source of truth shared with
// the MCP package. These are TYPE-ONLY re-exports, so they erase at build time
// and core keeps zero runtime dependencies. Only the engine-specific config and
// empty defaults below are owned by core.
export type {
  Severity,
  DetectorName,
  VibeIssue,
  FrameRateStats,
  ScriptAttribution,
  LongFrameEntry,
  LongFrameStats,
  VitalRating,
  WebVitalEntry,
  WebVitalsStats,
  HeapMemory,
  LargeResource,
  ResourceStats,
  ConsoleStats,
  VibeSnapshot,
  Collector,
  Detector,
  IssueEvidenceMap,
  EvidenceFor,
  AgentConnectionState,
  DispatchResultCode,
  ProjectSnapshotEnvelope,
  ProjectSummary,
  ProjectStatus,
  DispatchIssueRequest,
  DispatchIssueResponse,
  QueuedIssue,
  LeaseResult,
} from '@wcgw/vibe-check-protocol'

export {
  AGENT_CONNECTION_STATES,
  DISPATCH_RESULT_CODES,
} from '@wcgw/vibe-check-protocol'

import type {
  FrameRateStats,
  LongFrameStats,
  WebVitalsStats,
  ResourceStats,
  ConsoleStats,
} from '@wcgw/vibe-check-protocol'

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

// Engine config
export interface VibeCheckConfig {
  readonly enabled: boolean
  readonly beaconUrl?: string
  readonly projectId?: string
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
    readonly heavyLibrary: boolean
    readonly seo: boolean
    readonly aeo: boolean
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
    heavyLibrary: true,
    seo: true,
    aeo: true,
  },
}
