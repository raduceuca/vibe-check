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

import { AUDIT_DETECTORS, DETECTOR_NAMES, SEVERITIES } from './enums.js'
import { MCP_PACKAGE_VERSION } from './version.generated.js'

export { getIssueIdentity, getStableIssueKey, normalizePageUrl } from './issueIdentity.js'
export { AUDIT_DETECTORS, DETECTOR_NAMES, SEVERITIES } from './enums.js'
export { MCP_PACKAGE_VERSION } from './version.generated.js'
export {
  DELIVERY_ACK_TIMEOUT_MS,
  LEASE_EXPIRE_MS,
  MAX_WATCH_WAIT_SECONDS,
  WATCH_GRACE_MS,
} from './timing.js'
export {
  HUB_INTAKE_LIMITS,
  HUB_MAX_BODY_BYTES,
  KEEPALIVE_BODY_LIMIT_BYTES,
  PAYLOAD_LIMITS,
  SNAPSHOT_BODY_BUDGET_BYTES,
  boundEvidence,
  boundIssue,
  boundIssues,
  boundSnapshot,
  compareIssuePriority,
  fitEnvelopeToBytes,
  measureJsonBytes,
  truncateText,
} from './payload.js'
export type { BoundIssuesResult, PayloadLimits } from './payload.js'
export {
  DETECTOR_KINDS,
  LEGACY_VERIFICATION_DELAY_MS,
  VERIFICATION_CLEAN_SNAPSHOTS,
  classifyVerificationSnapshot,
  getDetectorRunStatus,
  isAuditDetector,
  issueLastSeenAt,
} from './verification.js'
export type { VerificationSnapshotInput } from './verification.js'
export {
  ALLOWED_ORIGINS_ENV,
  HUB_ERROR_CODES,
  isHostHeaderAllowed,
  isJsonContentType,
  isLoopbackHostname,
  isLoopbackOrigin,
  isOriginAllowed,
  normalizeOriginPattern,
  parseAllowedOrigins,
  safeDecodePathSegments,
} from './hubSecurity.js'
export type { HubErrorBody, HubErrorCode } from './hubSecurity.js'
export { agentClientLabel, formatLeaseConflictMessage } from './lease.js'
export { MCP_TOOL_CATALOG, MCP_TOOL_NAMES, getMcpToolDescriptor } from './toolCatalog.js'
export type { McpToolDescriptor, McpToolName, McpToolParam } from './toolCatalog.js'

// ── Enums (type + runtime list derived from one source) ─────────────────────
// The runtime arrays live in ./enums.ts (a leaf module) and are re-exported
// above; the types are derived here so `DetectorName` etc. stay one source.

export type Severity = (typeof SEVERITIES)[number]
export type DetectorName = (typeof DETECTOR_NAMES)[number]

// ── Issue ───────────────────────────────────────────────────────────────────

export interface VibeIssue {
  readonly id: string
  readonly detector: DetectorName
  readonly severity: Severity
  readonly title: string
  readonly description: string
  readonly evidence: Record<string, unknown>
  /** Epoch ms (producer clock) when this issue was first raised. */
  readonly timestamp: number
  readonly acknowledged: boolean
  readonly resolved: boolean
  /**
   * Since 0.4. Epoch ms (producer clock) when the condition was most recently
   * observed; always >= `timestamp`. Event detectors set it to the last
   * occurrence, state detectors refresh it on every evaluation that still sees
   * the condition, audits set it when a run reports the check. 0.3 producers
   * omit it; read it through `issueLastSeenAt()`, which falls back to
   * `timestamp`.
   */
  readonly lastSeenAt?: number
  /** Since 0.4. Times the condition was observed while this issue stayed open (>= 1). */
  readonly occurrences?: number
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

// ── Detector run status (verification evidence) ─────────────────────────────
// A snapshot that omits an issue only proves the issue is gone if the detector
// that would report it has actually looked since the moment in question. These
// shapes let the browser say so explicitly instead of the hub guessing.

/**
 * 'continuous' detectors observe the page all the time and retract an issue
 * once its condition has not recurred for their retention window. 'audit'
 * detectors (seo, aeo, web-essentials) run a discrete set of checks.
 */
export type DetectorKind = 'continuous' | 'audit'

export type AuditDetectorName = (typeof AUDIT_DETECTORS)[number]

export interface DetectorRunStatus {
  readonly detector: DetectorName
  readonly kind: DetectorKind
  /**
   * Epoch ms (producer clock) this detector began its current observation:
   * engine start, `clear()`, `recheck()`, or an SPA route change for audits.
   */
  readonly observingSince: number
  /**
   * Epoch ms when the detector completed its first full evaluation since
   * `observingSince` (continuous: warm-up window elapsed; audit: every check and
   * probe of the run finished). null while warming up or while a run is in
   * flight. Absence of this detector's issues is evidence only when non-null.
   */
  readonly settledAt: number | null
  /**
   * Epoch ms of the most recent completed evaluation. Continuous detectors
   * report the snapshot time once settled; audits report the last run's finish
   * time. null before the first evaluation.
   */
  readonly evaluatedAt: number | null
  /**
   * Check ids (evidence.check) the last run could not evaluate, e.g. a probe
   * that hit a network error. Absence of an issue for one of these checks is
   * never evidence.
   */
  readonly inconclusiveChecks?: readonly string[]
}

export type AuditRunStatus = 'running' | 'complete' | 'incomplete'

/** One audit pass of seo / aeo / web-essentials (site spec §1 P2). */
export interface AuditRun {
  readonly detector: AuditDetectorName
  readonly status: AuditRunStatus
  readonly startedAt: number
  readonly finishedAt?: number
  /** Check ids that failed in this run (one issue each). */
  readonly failedChecks: readonly string[]
  /** Check ids whose probe threw a network error (not a 404): "couldn't finish", never "passed". */
  readonly unreachable: readonly string[]
}

/** Present on a snapshot when bounding dropped or shortened anything. */
export interface SnapshotTruncation {
  /** Issues dropped to respect the per-detector / per-snapshot caps or the byte budget. */
  readonly droppedIssues: number
  /**
   * Detectors that lost at least one issue. For these detectors, absence in
   * this snapshot is NOT verification evidence.
   */
  readonly detectors: readonly DetectorName[]
  /** Strings shortened, arrays trimmed, keys or entries dropped. */
  readonly truncatedFields: number
}

// ── Snapshot (the wire payload) ─────────────────────────────────────────────

export interface VibeSnapshot {
  /** Epoch ms (producer clock) the snapshot was assembled. */
  readonly timestamp: number
  readonly frameRate: FrameRateStats
  readonly longFrames: LongFrameStats
  readonly webVitals: WebVitalsStats
  readonly memory: HeapMemory | null
  readonly resources: ResourceStats
  readonly console: ConsoleStats
  readonly issues: readonly VibeIssue[]
  readonly domNodeCount: number
  /** Since 0.4. Epoch ms (producer clock) the producing engine started. */
  readonly engineStartedAt?: number
  /**
   * Since 0.4. Run status of every detector enabled in the producing engine.
   * A detector missing from this list is not running, so its absence is never
   * evidence. 0.3 producers omit the whole field ("legacy" snapshots).
   */
  readonly detectors?: readonly DetectorRunStatus[]
  /** Since 0.4. Set when payload bounding dropped or shortened anything. */
  readonly truncation?: SnapshotTruncation
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

export const MCP_PACKAGE_NAME = '@wcgw/vibe-check-mcp'
export const WIDGET_PACKAGE_NAME = '@wcgw/vibe-check'
// Derived from packages/mcp/package.json at build time (src/version.generated.ts,
// written by scripts/gen-version.mjs). Never hand-type a version here.
export const MCP_PACKAGE_SPEC = `${MCP_PACKAGE_NAME}@${MCP_PACKAGE_VERSION}`
export const HUB_START_COMMAND = `npx -y ${MCP_PACKAGE_SPEC} hub`

// ── Local hub defaults ──────────────────────────────────────────────────────

export const DEFAULT_HUB_HOST = '127.0.0.1'
export const DEFAULT_HUB_PORT = 4200
export const DEFAULT_HUB_URL = `http://${DEFAULT_HUB_HOST}:${DEFAULT_HUB_PORT}`
/** Env var the `connect` bridge, `doctor` and `stats` read for a non-default hub. */
export const HUB_URL_ENV = 'VIBE_CHECK_HUB_URL'

/** Trims whitespace and trailing slashes; empty or missing input means DEFAULT_HUB_URL. */
export const normalizeHubUrl = (hubUrl?: string | null): string => {
  const trimmed = (hubUrl ?? '').trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : DEFAULT_HUB_URL
}

/** The hub's TCP port from its URL (scheme default when absent), or null when unparseable. */
export const hubPortFromUrl = (hubUrl: string): number | null => {
  try {
    const url = new URL(normalizeHubUrl(hubUrl))
    if (url.port.length > 0) return Number.parseInt(url.port, 10)
    return url.protocol === 'https:' ? 443 : 80
  } catch {
    return null
  }
}

const isDefaultHubUrl = (hubUrl: string): boolean => normalizeHubUrl(hubUrl) === DEFAULT_HUB_URL

export interface AgentClientSetupOptions {
  /**
   * The hub the widget beacons to. When it is not DEFAULT_HUB_URL the agent
   * config carries `VIBE_CHECK_HUB_URL`, because the agent (not the user)
   * spawns `connect`.
   */
  readonly hubUrl?: string
}

const CONNECT_ARGS = ['-y', MCP_PACKAGE_SPEC, 'connect'] as const
const CONNECT_COMMAND = `npx ${CONNECT_ARGS.join(' ')}`

const buildClientSetup = (client: AgentClientId, hubUrl: string): AgentClientSetup => {
  const env = isDefaultHubUrl(hubUrl) ? null : `${HUB_URL_ENV}=${normalizeHubUrl(hubUrl)}`
  if (client === 'codex') {
    return {
      id: 'codex',
      label: 'Codex',
      format: 'command',
      destination: 'Run in the project directory',
      value: env === null
        ? `codex mcp add vibe-check -- ${CONNECT_COMMAND}`
        : `codex mcp add vibe-check --env ${env} -- ${CONNECT_COMMAND}`,
      verifyCommand: 'codex mcp get vibe-check --json',
    }
  }
  if (client === 'claude-code') {
    return {
      id: 'claude-code',
      label: 'Claude Code',
      format: 'command',
      destination: 'Run in the project directory',
      // `-e` is variadic in the Claude CLI, so it goes after the server name
      // and is closed by `--` (the form `claude mcp add --help` documents).
      value: env === null
        ? `claude mcp add --scope local vibe-check -- ${CONNECT_COMMAND}`
        : `claude mcp add --scope local vibe-check -e ${env} -- ${CONNECT_COMMAND}`,
      verifyCommand: 'claude mcp get vibe-check',
    }
  }
  return {
    id: 'cursor',
    label: 'Cursor',
    format: 'json',
    destination: 'Add inside mcpServers in .cursor/mcp.json; if the file is new, create mcpServers first',
    value: JSON.stringify({
      'vibe-check': env === null
        ? { command: 'npx', args: [...CONNECT_ARGS] }
        : { command: 'npx', args: [...CONNECT_ARGS], env: { [HUB_URL_ENV]: normalizeHubUrl(hubUrl) } },
    }, null, 2),
    verifyCommand: 'cursor-agent mcp list-tools vibe-check',
  }
}

export const getAgentClientSetup = (
  client: AgentClientId,
  options: AgentClientSetupOptions = {},
): AgentClientSetup => buildClientSetup(client, options.hubUrl ?? DEFAULT_HUB_URL)

export const getWatchInstruction = (projectId: string): string =>
  `Use the vibe-check MCP tools. Call list_projects, then call watch_for_issue with project_id "${projectId}" and keep waiting for the next issue I send from the widget.`

export const UP_START_COMMAND = `npx -y ${MCP_PACKAGE_SPEC} up`

export interface HubStartCommandOptions {
  /** Guided `up` (default true) or the bare long-running `hub`. */
  readonly preferUp?: boolean
  /** Required for `up` to name the project; ignored by `hub`. */
  readonly projectId?: string
  readonly agent?: AgentClientId
  /** A non-default port is passed as `--port <n>` (both `up` and `hub` accept it from 0.4). */
  readonly hubUrl?: string
}

export const getHubStartCommand = ({
  preferUp = true,
  projectId,
  agent,
  hubUrl = DEFAULT_HUB_URL,
}: HubStartCommandOptions = {}): string => {
  const port = hubPortFromUrl(hubUrl)
  const portFlag = port !== null && port !== DEFAULT_HUB_PORT ? ` --port ${port}` : ''
  if (!preferUp) return `${HUB_START_COMMAND}${portFlag}`
  const project = projectId !== undefined ? ` --project ${projectId}` : ''
  const agentFlag = agent !== undefined ? ` --agent ${agent}` : ''
  return `${UP_START_COMMAND}${project}${agentFlag}${portFlag}`
}

/** Read-only connection check. A non-default hub is passed as `--hub-url` (accepted from 0.4). */
export const getDoctorCommand = (projectId: string, hubUrl: string = DEFAULT_HUB_URL): string =>
  `npx -y ${MCP_PACKAGE_SPEC} doctor --project ${projectId}${
    isDefaultHubUrl(hubUrl) ? '' : ` --hub-url ${normalizeHubUrl(hubUrl)}`
  }`

export interface SetupPackOptions {
  readonly projectId: string
  readonly agent: AgentClientId
  /** Prefer the guided `up` hub command when true (default true). */
  readonly preferUp?: boolean
  /** Since 0.4. The hub URL the widget uses; a non-default port/URL is carried into every command. */
  readonly hubUrl?: string
  /**
   * Since 0.4. True when the hub is already reachable (the widget can see it, or
   * this text is printed by the running `up`): the pack says so instead of
   * telling the user to start a second hub.
   */
  readonly hubRunning?: boolean
}

/** One clipboard-ready block: hub + agent setup + watch instruction. */
export const formatSetupPack = ({
  projectId,
  agent,
  preferUp = true,
  hubUrl = DEFAULT_HUB_URL,
  hubRunning = false,
}: SetupPackOptions): string => {
  const setup = getAgentClientSetup(agent, { hubUrl })
  const hubSection = hubRunning
    ? ['### 1. Local hub', `The hub is already running at ${normalizeHubUrl(hubUrl)}. Leave it running.`]
    : ['### 1. Start the local hub', getHubStartCommand({ preferUp, projectId, agent, hubUrl })]
  const setupBlock = setup.format === 'json'
    ? `Merge into .cursor/mcp.json under mcpServers:\n${setup.value}`
    : setup.value
  return [
    `## VibeCheck setup — ${projectId}`,
    '',
    ...hubSection,
    '',
    `### 2. ${setup.label} MCP`,
    setup.destination,
    setupBlock,
    '',
    '### 3. Restart or open a new agent session',
    'MCP configuration is loaded when the agent session starts.',
    '',
    '### 4. Watch this project (paste into the agent)',
    getWatchInstruction(projectId),
    '',
    '### 5. In the widget',
    'Wait for Agent connected (green), then click **Send to agent** on an issue.',
    '',
    `Check the connection (read-only): ${getDoctorCommand(projectId, hubUrl)}`,
    '',
  ].join('\n')
}

// 'leased' (since 0.4): an agent session holds the project but no
// watch_for_issue call is waiting right now. 'watching' now means a
// watch_for_issue call is open on the hub (or ended within WATCH_GRACE_MS).
// Appended at the end so existing indexes keep their meaning.
export const AGENT_CONNECTION_STATES = ['no-agent', 'watching', 'busy', 'stale', 'leased'] as const
export type AgentConnectionState = (typeof AGENT_CONNECTION_STATES)[number]

/**
 * States in which the hub accepts a dispatch: delivered at once to a waiting
 * watcher ('dispatched'), or queued for the owner's next watch ('queued').
 */
export const DISPATCHABLE_AGENT_STATES = ['watching', 'leased', 'busy'] as const satisfies readonly AgentConnectionState[]

export const isDispatchableAgentState = (state: AgentConnectionState | null | undefined): boolean =>
  state !== null && state !== undefined
  && (DISPATCHABLE_AGENT_STATES as readonly AgentConnectionState[]).includes(state)

// 'queued' (since 0.4, ok: true): accepted, but no watch_for_issue call is
// waiting; it is delivered on the owner's (or the next owner's) next watch.
// 'origin-not-allowed' (since 0.4): the hub refused the page's Origin.
export const DISPATCH_RESULT_CODES = [
  'dispatched',
  'unconfigured',
  'hub-offline',
  'agent-not-watching',
  'queue-full',
  'invalid-issue',
  'failed',
  'queued',
  'origin-not-allowed',
] as const
export type DispatchResultCode = (typeof DISPATCH_RESULT_CODES)[number]

export interface ProjectSnapshotEnvelope {
  readonly projectId: string
  readonly instanceId: string
  readonly origin: string
  readonly pageUrl: string
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

/** Who holds a project's lease (since 0.4). Never includes the session id. */
export interface LeaseHolder {
  /** MCP client name the holding bridge reported at initialize (e.g. "claude-code"), when known. */
  readonly clientName: string | null
  readonly acquiredAt: number
  readonly heartbeatAt: number
  readonly expiresAt: number
  readonly state: AgentConnectionState
}

export interface ProjectStatus {
  readonly projectId: string
  readonly state: AgentConnectionState
  /** Dispatches accepted by the hub and not yet handed to a watcher. */
  readonly queueDepth: number
  readonly leaseExpiresAt: number | null
  readonly conflictAt: number | null
  /** Since 0.4. True only while a watch_for_issue long-poll is open on the hub. */
  readonly waiting?: boolean
  /** Since 0.4. Dispatches handed to a watcher whose bridge has not confirmed receipt. */
  readonly inFlightDepth?: number
  /** Since 0.4. The current lease holder, or null when nobody holds the project. */
  readonly holder?: LeaseHolder | null
}

export interface DispatchIssueRequest {
  readonly projectId: string
  readonly instanceId: string
  readonly pageUrl: string
  readonly issue: VibeIssue
}

export interface DispatchIssueResponse {
  readonly ok: boolean
  readonly code: DispatchResultCode
  readonly projectId: string
  readonly queueDepth: number
  /** Since 0.4. Set when the hub accepted the dispatch ('dispatched' or 'queued'). */
  readonly deliveryId?: string
}

export interface QueuedIssue {
  readonly projectId: string
  readonly issueKey: string
  readonly issue: VibeIssue
  readonly snapshot: VibeSnapshot
  readonly dispatchedAt: number
  /**
   * Since 0.4. Identifies this dispatch through the two-phase hand-off: the
   * bridge confirms receipt with it (→ phase 'working') or hands it back
   * (→ re-queued). Always set by 0.4 hubs.
   */
  readonly deliveryId?: string
  /** Since 0.4. Times this dispatch has been handed to a watcher (1 on first delivery). */
  readonly attempts?: number
}

export type IssuePhase = 'detected' | 'sent' | 'working' | 'verifying' | 'fixed' | 'regressed'

export interface IssueWorkflowEvent {
  readonly type:
    | 'detected'
    | 'sent'
    | 'working'
    | 'verification-requested'
    | 'verification-failed'
    | 'fixed'
    | 'regressed'
    // Since 0.4: a dispatch the hub accepted was lost before any agent
    // received it (only when loading state written by a 0.3 hub, which kept
    // its queue in memory). The phase returns to 'detected'.
    | 'dispatch-dropped'
  readonly at: number
  readonly occurrence: number
}

// ── Two-phase delivery (since 0.4) ──────────────────────────────────────────

/** Bridge → hub: confirm or hand back one delivered dispatch. */
export interface DeliveryReceiptRequest {
  readonly sessionId: string
  readonly deliveryId: string
}

export const DELIVERY_RECEIPT_CODES = [
  'delivered',
  'requeued',
  'unknown-delivery',
  'lease-conflict',
] as const
export type DeliveryReceiptCode = (typeof DELIVERY_RECEIPT_CODES)[number]

export interface DeliveryReceiptResult {
  readonly ok: boolean
  readonly code: DeliveryReceiptCode
  readonly projectId: string
  readonly deliveryId: string
}

// ── Issue actions and verification status (since 0.4) ───────────────────────

export const ISSUE_ACTION_CODES = [
  'acknowledged',
  'verifying',
  'already-verifying',
  'already-fixed',
  'issue-not-found',
  'project-not-found',
  'lease-conflict',
] as const
export type IssueActionCode = (typeof ISSUE_ACTION_CODES)[number]

/**
 * Result of acknowledge / resolve (bridge) and verify (browser). An id that
 * matches no tracked issue — by id or by stable key — is 'issue-not-found',
 * never a silent success.
 */
export interface IssueActionResult {
  readonly ok: boolean
  readonly code: IssueActionCode
  readonly projectId: string
  readonly issueId: string
  readonly issueKey: string | null
  readonly phase: IssuePhase | null
  /** Set with 'lease-conflict'. */
  readonly holder?: LeaseHolder
}

export const VERIFICATION_OUTCOMES = ['pending', 'fixed', 'still-present', 'not-requested'] as const
export type VerificationOutcome = (typeof VERIFICATION_OUTCOMES)[number]

/** Why one snapshot neither proved nor disproved a fix. */
export type VerificationInconclusiveReason =
  | 'snapshot-before-request'
  | 'stale-issue'
  | 'detector-not-running'
  | 'detector-not-settled'
  | 'evaluation-before-request'
  | 'check-not-evaluated'
  | 'truncated'
  | 'legacy-too-soon'

/** What one snapshot says about an issue under verification. */
export type VerificationEvidence =
  | { readonly kind: 'recurred'; readonly at: number }
  | { readonly kind: 'clean'; readonly confidence: ImpactConfidence }
  | { readonly kind: 'inconclusive'; readonly reason: VerificationInconclusiveReason }

export interface IssueVerificationStatus {
  readonly projectId: string
  readonly issueId: string
  readonly issueKey: string
  readonly phase: IssuePhase
  /**
   * 'fixed': fresh browser evidence confirmed it. 'still-present': the latest
   * request failed (phase back to 'working'). 'pending': waiting for evidence.
   * 'not-requested': no verification has been requested for this occurrence.
   */
  readonly outcome: VerificationOutcome
  readonly requestedAt: number | null
  readonly decidedAt: number | null
  /** Clean snapshots counted toward `requiredCleanSnapshots` for the pending request. */
  readonly cleanSnapshots: number
  readonly requiredCleanSnapshots: number
  /** Why the verdict is still pending, from the latest snapshot; null when decided or unknown. */
  readonly waitingFor: VerificationInconclusiveReason | 'no-snapshot-yet' | null
}

export interface TrackedProjectIssue {
  readonly issueKey: string
  readonly pageUrl: string
  readonly issue: VibeIssue
  readonly occurrenceIds: readonly string[]
  readonly phase: IssuePhase
  readonly occurrenceCount: number
  readonly regressionCount: number
  readonly verificationMisses: number
  readonly firstSeenAt: number
  readonly lastSeenAt: number
  readonly events: readonly IssueWorkflowEvent[]
}

export type ImpactConfidence = 'measured' | 'estimated'

export type ImpactMetricKind =
  | 'duplicate-requests-removed'
  | 'console-calls-reduced'
  | 'dom-nodes-reduced'
  | 'transfer-kb-reduced'
  | 'blocking-ms-reduced'

export type ImpactUnit = 'requests' | 'calls' | 'nodes' | 'KB' | 'ms'

export interface ImpactReceipt {
  readonly id: string
  readonly issueKey: string
  readonly occurrence: number
  readonly detector: DetectorName
  readonly pageUrl: string
  readonly baselineSnapshotAt: number
  readonly verificationSnapshotAt: number
  readonly kind: ImpactMetricKind
  readonly before: number
  readonly after: number
  readonly delta: number
  readonly unit: ImpactUnit
  readonly confidence: ImpactConfidence
}

export interface ImpactMetric {
  readonly kind: ImpactMetricKind
  readonly value: number
  readonly unit: ImpactUnit
  readonly confidence: ImpactConfidence
  readonly label: string
  readonly scope: string
}

export interface ProjectImpactSummary {
  readonly projectId: string
  readonly detected: number
  readonly sent: number
  readonly uniqueIssuesFixed: number
  readonly verifiedFixes: number
  readonly regressionsCaught: number
  readonly verificationFailures: number
  readonly medianFixTimeMs: number | null
  readonly metrics: readonly ImpactMetric[]
}

export interface ProjectWorkflow {
  readonly schemaVersion: 1
  readonly projectId: string
  readonly revision: number
  readonly impactResetAt: number | null
  readonly impactReceipts: readonly ImpactReceipt[]
  readonly issues: readonly TrackedProjectIssue[]
}

/** Bridge → hub lease acquire / heartbeat / release body. */
export interface LeaseRequest {
  readonly sessionId: string
  /** Since 0.4. MCP client name from the bridge's initialize handshake, shown to other sessions on conflict. */
  readonly clientName?: string
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
      /** Since 0.4. Set with 'lease-conflict'. */
      readonly holder?: LeaseHolder
      /** Since 0.4. Plain-language explanation (see formatLeaseConflictMessage). */
      readonly message?: string
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
  /**
   * Drops this detector's issues and dedupe state and restarts its observation
   * window: from 0.4, `getStatus().observingSince` becomes now and `settledAt`
   * null until the detector has looked again.
   */
  clear(): void
  /**
   * Since 0.4. Verification evidence for snapshots. Every built-in detector
   * implements it; a detector without it is treated as never settled, so its
   * absence never verifies a fix.
   */
  getStatus?(): DetectorRunStatus
  /** Since 0.4. Audit detectors only (seo, aeo, web-essentials); null before the first run. */
  getAuditRun?(): AuditRun | null
}
