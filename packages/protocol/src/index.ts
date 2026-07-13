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
  'seo',
  'aeo',
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
  // CSS selector for the heaviest top-level subtree, so the overlay can flag it
  // on the page.
  readonly selector?: string
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
  // All problems found on this one image (e.g. ['missing-lazy',
  // 'missing-dimensions']). One issue is emitted per image, not per problem, so
  // an image with several faults shows a single annotation rather than N
  // near-identical ones.
  readonly problems: readonly string[]
  // How many images share this exact problem signature. The detector collapses
  // repeat offenders (e.g. a grid of identically-broken thumbnails) into one
  // issue carrying a count, rather than N near-identical rows. 1 (or omitted)
  // means a single image.
  readonly count?: number
  // Intrinsic + rendered dimensions of the representative image, so the overlay
  // can title by size ("2400×1200 image") when the URL has no filename.
  readonly naturalWidth?: number
  readonly naturalHeight?: number
  readonly renderedWidth?: number
  readonly renderedHeight?: number
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
export interface SeoEvidence {
  // Which discoverability check failed: 'title-missing', 'title-too-long',
  // 'title-default', 'meta-description-missing', 'meta-description-too-long',
  // 'og-image-missing', 'og-title-missing', 'og-description-missing',
  // 'canonical-missing', 'h1-missing', 'h1-multiple', 'image-alt-missing',
  // 'slug-unfriendly', 'sitemap-missing', 'robots-missing'.
  readonly check: string
  // Human-readable specifics, e.g. '72 chars' or '5 images'.
  readonly detail?: string
}
export interface AeoEvidence {
  // Answer-engine / AI-agent readiness check that failed: 'llms-txt-missing',
  // 'content-requires-js', 'markdown-negotiation-missing', 'ai-crawlers-blocked',
  // 'structured-data-missing', 'mcp-discovery-missing'.
  readonly check: string
  readonly detail?: string
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
  readonly 'seo': SeoEvidence
  readonly 'aeo': AeoEvidence
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

// ── Local hub / agent routing contract ─────────────────────────────────────

export const AGENT_CLIENTS = ['codex', 'claude-code', 'cursor'] as const
export type AgentClientId = (typeof AGENT_CLIENTS)[number]

export interface AgentClientSetup {
  readonly id: AgentClientId
  readonly label: string
  readonly format: 'command' | 'json'
  readonly destination: string
  readonly value: string
  readonly verifyCommand: string
}

export const MCP_PACKAGE_SPEC = '@wcgw/vibe-check-mcp@0.2.0'
export const HUB_START_COMMAND = `npx -y ${MCP_PACKAGE_SPEC} hub`

const CLIENT_SETUPS: Readonly<Record<AgentClientId, AgentClientSetup>> = {
  codex: {
    id: 'codex',
    label: 'Codex',
    format: 'command',
    destination: 'Run in the project directory',
    value: `codex mcp add vibe-check -- npx -y ${MCP_PACKAGE_SPEC} connect`,
    verifyCommand: 'codex mcp get vibe-check --json',
  },
  'claude-code': {
    id: 'claude-code',
    label: 'Claude Code',
    format: 'command',
    destination: 'Run in the project directory',
    value: `claude mcp add --scope local vibe-check -- npx -y ${MCP_PACKAGE_SPEC} connect`,
    verifyCommand: 'claude mcp get vibe-check',
  },
  cursor: {
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    destination: 'Add inside mcpServers in .cursor/mcp.json; if the file is new, create mcpServers first',
    value: JSON.stringify({
      'vibe-check': {
        command: 'npx',
        args: ['-y', MCP_PACKAGE_SPEC, 'connect'],
      },
    }, null, 2),
    verifyCommand: 'cursor-agent mcp list-tools vibe-check',
  },
}

export const getAgentClientSetup = (client: AgentClientId): AgentClientSetup =>
  CLIENT_SETUPS[client]

export const getWatchInstruction = (projectId: string): string =>
  `Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "${projectId}" and keep waiting for the next issue I send from the widget.`

export const AGENT_CONNECTION_STATES = ['no-agent', 'watching', 'busy', 'stale'] as const
export type AgentConnectionState = (typeof AGENT_CONNECTION_STATES)[number]

export const DISPATCH_RESULT_CODES = [
  'dispatched',
  'unconfigured',
  'hub-offline',
  'agent-not-watching',
  'queue-full',
  'invalid-issue',
  'failed',
] as const
export type DispatchResultCode = (typeof DISPATCH_RESULT_CODES)[number]

export interface ProjectSnapshotEnvelope {
  readonly projectId: string
  readonly instanceId: string
  readonly origin: string
  readonly title: string
  readonly snapshot: VibeSnapshot
}

export interface ProjectSummary {
  readonly projectId: string
  readonly origin: string
  readonly title: string
  readonly instanceCount: number
  readonly lastSeenAt: number
  readonly agentState: AgentConnectionState
}

export interface ProjectStatus {
  readonly projectId: string
  readonly state: AgentConnectionState
  readonly queueDepth: number
  readonly leaseExpiresAt: number | null
  readonly conflictAt: number | null
}

export interface DispatchIssueRequest {
  readonly projectId: string
  readonly instanceId: string
  readonly issue: VibeIssue
}

export interface DispatchIssueResponse {
  readonly ok: boolean
  readonly code: DispatchResultCode
  readonly projectId: string
  readonly queueDepth: number
}

export interface QueuedIssue {
  readonly projectId: string
  readonly issue: VibeIssue
  readonly snapshot: VibeSnapshot
  readonly dispatchedAt: number
}

export type LeaseResult =
  | {
      readonly ok: true
      readonly projectId: string
      readonly expiresAt: number
    }
  | {
      readonly ok: false
      readonly code: 'project-not-found' | 'lease-conflict' | 'session-already-watching'
      readonly projectId: string
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
