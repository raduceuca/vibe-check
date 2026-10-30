// Types
export type {
  Severity,
  DetectorName,
  VibeIssue,
  FrameRateStats,
  LongFrameEntry,
  ScriptAttribution,
  VitalRating,
  WebVitalEntry,
  WebVitalsStats,
  HeapMemory,
  ResourceStats,
  LargeResource,
  LongFrameStats,
  ConsoleStats,
  VibeSnapshot,
  VibeCheckConfig,
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
  // Since 0.4
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
} from './types.js'

export {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
  DEFAULT_CONFIG,
  AGENT_CLIENTS,
  AGENT_CONNECTION_STATES,
  DISPATCH_RESULT_CODES,
  MCP_PACKAGE_SPEC,
  HUB_START_COMMAND,
  UP_START_COMMAND,
  getAgentClientSetup,
  getWatchInstruction,
  formatSetupPack,
  // Since 0.4
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
} from './types.js'

// Engine
export { VibeCheckEngine } from './engine.js'
export type { VibeEngine } from './engine.js'

// Scripted engine (deterministic snapshot/issue playback for demos)
export { createScriptedEngine } from './scriptedEngine.js'
export type { ScriptedScenario, ScriptedFrame } from './scriptedEngine.js'

// Collectors
export { FrameRateCollector } from './collectors/frameRate.js'
export { LongFrameCollector } from './collectors/longFrames.js'
export { MemoryCollector } from './collectors/memory.js'
export { WebVitalsCollector } from './collectors/webVitals.js'
export { ResourceCollector } from './collectors/resources.js'
export { ConsoleCollector } from './collectors/console.js'

// Detectors
export { createDomBloatDetector } from './detectors/domBloat.js'
export { createDuplicateRequestsDetector } from './detectors/duplicateRequests.js'
export { createConsoleSpamDetector } from './detectors/consoleSpam.js'
export { createMemoryLeakDetector } from './detectors/memoryLeak.js'
export { createLayoutThrashingDetector } from './detectors/layoutThrashing.js'
export { createUnoptimizedImagesDetector } from './detectors/unoptimizedImages.js'
export { createLongTaskAttributionDetector } from './detectors/longTaskAttribution.js'
export { createResourceBloatDetector } from './detectors/resourceBloat.js'
export { createLargeImagesDetector } from './detectors/largeImages.js'
export { createWebEssentialsDetector } from './detectors/webEssentials.js'
export { createSeoDetector, SEO_CRITERIA_COUNT } from './detectors/seo.js'
export { createAeoDetector, AEO_CRITERIA_COUNT } from './detectors/aeo.js'
export { createHeavyLibraryDetector, LIBRARY_SIGNATURES } from './detectors/heavyLibrary.js'
export type { LibrarySignature } from './detectors/heavyLibrary.js'

// Beacon
export { BeaconClient } from './beacon/beaconClient.js'
export type { BeaconClientConfig, BeaconStatus, BeaconFailure } from './beacon/beaconClient.js'

// Suggestions
export { getSuggestion, getAgentPrompt, PROACTIVE_PROMPTS } from './suggestions/index.js'
export type { SuggestionMode, Suggestion, ProactivePrompt } from './suggestions/index.js'

// Utils
export { RingBuffer } from './utils/ringBuffer.js'
export {
  hasPerformanceObserver,
  hasEntryType,
  hasPerformanceMemory,
  hasLongAnimationFrame,
  hasLayoutShift,
  hasLargestContentfulPaint,
  hasEventTiming,
  hasMutationObserver,
  hasResourceTiming,
} from './utils/featureDetect.js'
export {
  probeFetch,
  createProbeCache,
  VC_PROBE,
  isProbeInit,
} from './utils/probe.js'
export type { ProbeCache, ProbeResult, ProbeRequestInit, AuditDetectorOptions } from './utils/probe.js'
