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
  IssuePhase,
  IssueWorkflowEvent,
  TrackedProjectIssue,
  ProjectWorkflow,
  ImpactConfidence,
  ImpactMetricKind,
  ImpactUnit,
  ImpactReceipt,
  ImpactMetric,
  ProjectImpactSummary,
  LeaseResult,
  AgentClientId,
  AgentClientSetup,
  SetupPackOptions,
  // Since 0.4 (CONTRACT §3.8). React imports only from core, so every shape it
  // needs from the protocol is re-exported here.
  DetectorKind,
  DetectorRunStatus,
  AuditRun,
  AuditRunStatus,
  AuditDetectorName,
  SnapshotTruncation,
  LeaseHolder,
  LeaseRequest,
  IssueActionResult,
  IssueActionCode,
  IssueVerificationStatus,
  VerificationOutcome,
  VerificationEvidence,
  VerificationInconclusiveReason,
  DeliveryReceiptRequest,
  DeliveryReceiptResult,
  DeliveryReceiptCode,
  AgentClientSetupOptions,
  HubStartCommandOptions,
  McpToolDescriptor,
  McpToolName,
  McpToolParam,
  PayloadLimits,
} from '@wcgw/vibe-check-protocol'

// Runtime values are bundled into core's own output (tsup noExternal), so the
// zero-runtime-dependency rule holds.
export {
  AGENT_CLIENTS,
  AGENT_CONNECTION_STATES,
  DISPATCH_RESULT_CODES,
  MCP_PACKAGE_SPEC,
  HUB_START_COMMAND,
  UP_START_COMMAND,
  getAgentClientSetup,
  getWatchInstruction,
  formatSetupPack,
  // Since 0.4 (CONTRACT §3.8)
  getHubStartCommand,
  getDoctorCommand,
  DEFAULT_HUB_URL,
  DEFAULT_HUB_PORT,
  HUB_URL_ENV,
  normalizeHubUrl,
  hubPortFromUrl,
  isDispatchableAgentState,
  DISPATCHABLE_AGENT_STATES,
  formatLeaseConflictMessage,
  agentClientLabel,
  MCP_PACKAGE_NAME,
  WIDGET_PACKAGE_NAME,
  MCP_PACKAGE_VERSION,
  MCP_TOOL_CATALOG,
  MCP_TOOL_NAMES,
  getMcpToolDescriptor,
  classifyVerificationSnapshot,
  issueLastSeenAt,
  getIssueIdentity,
  PAYLOAD_LIMITS,
  boundIssue,
  boundSnapshot,
  fitEnvelopeToBytes,
  AUDIT_DETECTORS,
  DETECTOR_KINDS,
  VERIFICATION_OUTCOMES,
  ISSUE_ACTION_CODES,
} from '@wcgw/vibe-check-protocol'

// Engine-internal runtime helpers from the protocol (not part of core's public
// index; used by the engine and beacon only).
export {
  boundIssues,
  measureJsonBytes,
  normalizePageUrl,
  KEEPALIVE_BODY_LIMIT_BYTES,
  SNAPSHOT_BODY_BUDGET_BYTES,
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
  /** When false, start() is a no-op and the engine stays stopped. */
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
