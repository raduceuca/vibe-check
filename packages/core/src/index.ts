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
  LeaseResult,
} from './types.js'

export {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
  DEFAULT_CONFIG,
  AGENT_CONNECTION_STATES,
  DISPATCH_RESULT_CODES,
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
export type { BeaconClientConfig, BeaconStatus } from './beacon/beaconClient.js'

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
