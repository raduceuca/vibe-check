// MCP consumes the shared wire contract from @wcgw/vibe-check-protocol — the
// single source of truth it shares with the browser core. Previously this file
// hand-mirrored those types with weaker shapes (rating: string, entries:
// unknown[]) and drifted from core; now the shapes come from one place.
//
// Type names are aliased to MCP's historical public names (FrameRate, LongFrames,
// WebVitals, MemoryInfo, ResourceInfo) so the published lib.ts API stays stable.
export type {
  Severity,
  DetectorName,
  VibeIssue,
  WebVitalEntry,
  ConsoleStats,
  VibeSnapshot,
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
  LeaseResult,
  AgentClientId,
  AgentClientSetup,
} from '@wcgw/vibe-check-protocol'

export {
  AGENT_CLIENTS,
  AGENT_CONNECTION_STATES,
  DISPATCH_RESULT_CODES,
  MCP_PACKAGE_SPEC,
  HUB_START_COMMAND,
  getAgentClientSetup,
  getWatchInstruction,
} from '@wcgw/vibe-check-protocol'

export type {
  FrameRateStats as FrameRate,
  LongFrameStats as LongFrames,
  WebVitalsStats as WebVitals,
  HeapMemory as MemoryInfo,
  ResourceStats as ResourceInfo,
} from '@wcgw/vibe-check-protocol'
