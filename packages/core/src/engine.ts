import type {
  VibeSnapshot,
  VibeIssue,
  VibeCheckConfig,
  Detector,
  DetectorName,
  DetectorRunStatus,
  AuditDetectorName,
  AuditRun,
  FrameRateStats,
  LongFrameStats,
  WebVitalsStats,
  HeapMemory,
  ResourceStats,
  ConsoleStats,
  DispatchIssueResponse,
} from './types.js'
import {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
  DEFAULT_CONFIG,
  AUDIT_DETECTORS,
  DETECTOR_KINDS,
  boundIssues,
  boundSnapshot,
  normalizePageUrl,
} from './types.js'
import { FrameRateCollector } from './collectors/frameRate.js'
import { LongFrameCollector } from './collectors/longFrames.js'
import { MemoryCollector } from './collectors/memory.js'
import { WebVitalsCollector } from './collectors/webVitals.js'
import { ResourceCollector } from './collectors/resources.js'
import { ConsoleCollector } from './collectors/console.js'
import { createDomBloatDetector } from './detectors/domBloat.js'
import { createDuplicateRequestsDetector } from './detectors/duplicateRequests.js'
import { createConsoleSpamDetector } from './detectors/consoleSpam.js'
import { createMemoryLeakDetector } from './detectors/memoryLeak.js'
import { createLayoutThrashingDetector } from './detectors/layoutThrashing.js'
import { createUnoptimizedImagesDetector } from './detectors/unoptimizedImages.js'
import { createLongTaskAttributionDetector } from './detectors/longTaskAttribution.js'
import { createResourceBloatDetector } from './detectors/resourceBloat.js'
import { createLargeImagesDetector } from './detectors/largeImages.js'
import { createWebEssentialsDetector } from './detectors/webEssentials.js'
import { createHeavyLibraryDetector } from './detectors/heavyLibrary.js'
import { createSeoDetector } from './detectors/seo.js'
import { createAeoDetector } from './detectors/aeo.js'
import { BeaconClient, type BeaconStatus } from './beacon/beaconClient.js'

type SnapshotCallback = (snapshot: VibeSnapshot) => void

// The public engine surface the React widget (VibeCheckProvider / useVibeCheck /
// useDetectedIssues) consumes. Both the live VibeCheckEngine and the scripted
// engine implement this, so a scripted demo is a drop-in replacement for the
// real thing.
export interface VibeEngine {
  start(): void
  stop(): void
  getSnapshot(): VibeSnapshot
  getIssues(): readonly VibeIssue[]
  /** No argument clears every detector (as before 0.4); a name clears only that detector. */
  clearIssues(detector?: DetectorName): void
  onSnapshot(callback: SnapshotCallback): () => void
  isRunning(): boolean
  getBeaconStatus(): BeaconStatus | null
  dispatchIssue(issue: VibeIssue): Promise<DispatchIssueResponse>
  /**
   * Since 0.4. Restarts one detector with fresh state and resolves once it has
   * settled again (an audit has finished its run), or after 30 s. Optional, so
   * engines written against 0.3 (and createScriptedEngine) stay valid.
   */
  recheck?(detector: DetectorName): Promise<void>
  /** Since 0.4. The latest run of an audit detector, or null before its first run or when it is disabled. */
  getAuditRun?(detector: AuditDetectorName): AuditRun | null
}

// A set of detectors started together. seo and aeo started in one batch share
// one fresh probe cache (SPEC-P1), so origin-level files are fetched once per run.
type RunBatch = Readonly<Record<string, never>>

type DetectorFactory = (batch: RunBatch) => Detector

const createRunBatch = (): RunBatch => ({})

const DOM_COUNT_INTERVAL_MS = 2_000
const SNAPSHOT_NOTIFY_INTERVAL_MS = 500
const RECHECK_TIMEOUT_MS = 30_000
const RECHECK_POLL_MS = 100
const ROUTE_RECHECK_DEBOUNCE_MS = 300
const WIDGET_ROOT_SELECTOR = '[data-wcgw]'

// Elements in the document, minus the VibeCheck widget's own subtrees (every
// widget root carries data-wcgw, roots included), so opening the panel does
// not push the page over a dom-bloat threshold (C26).
const countPageElements = (): number => {
  const total = document.querySelectorAll('*').length
  const roots = document.querySelectorAll(WIDGET_ROOT_SELECTOR)
  let own = 0
  for (let index = 0; index < roots.length; index += 1) {
    const root = roots[index]
    if (root === undefined) continue
    // A root nested in another root is already counted by its ancestor.
    if (root.parentElement?.closest(WIDGET_ROOT_SELECTOR)) continue
    own += 1 + root.getElementsByTagName('*').length
  }
  return Math.max(0, total - own)
}

const fallbackStatus = (detector: DetectorName, observingSince: number): DetectorRunStatus => ({
  detector,
  kind: DETECTOR_KINDS[detector],
  observingSince,
  settledAt: null,
  evaluatedAt: null,
})

// Has this detector looked at the page since it was (re)started? A detector
// without getStatus() reports nothing to wait for.
const hasSettled = (detector: Detector): boolean => {
  const status = detector.getStatus?.()
  if (status === undefined || status.settledAt !== null) return true
  const run = detector.getAuditRun?.() ?? null
  return run !== null && run.status !== 'running'
}

export class VibeCheckEngine implements VibeEngine {
  private readonly config: VibeCheckConfig
  private running = false
  private engineStartedAt: number | null = null

  // Collectors
  private frameRateCollector: FrameRateCollector | null = null
  private longFrameCollector: LongFrameCollector | null = null
  private memoryCollector: MemoryCollector | null = null
  private webVitalsCollector: WebVitalsCollector | null = null
  private resourceCollector: ResourceCollector | null = null
  private consoleCollector: ConsoleCollector | null = null

  // Detectors, in start order, and how to build a fresh one for recheck().
  private detectors: readonly Detector[] = []
  private factories: ReadonlyMap<DetectorName, DetectorFactory> = new Map()

  // Beacon
  private beaconClient: BeaconClient | null = null

  // Callbacks
  private readonly listeners: Set<SnapshotCallback> = new Set()

  // DOM node count (cached, updated on its own interval)
  private cachedDomNodeCount = 0
  private domCountIntervalId: ReturnType<typeof setInterval> | undefined = undefined

  // Snapshot update interval
  private snapshotIntervalId: ReturnType<typeof setInterval> | undefined = undefined

  // SPA navigation (C15)
  private restoreNavigation: (() => void) | null = null
  private routeTimerId: ReturnType<typeof setTimeout> | undefined = undefined
  private routeRecheckPending = false
  private lastAuditedUrl: string | null = null

  constructor(config: Partial<VibeCheckConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      detectors: {
        ...DEFAULT_CONFIG.detectors,
        ...config.detectors,
      },
    }
  }

  start(): void {
    if (this.running) return
    if (!this.config.enabled) return
    // Outside a browser (SSR, plain Node) there is no page to observe.
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    this.running = true
    this.engineStartedAt = Date.now()
    try {
      this.startAll()
    } catch (error) {
      // Leave nothing half-started (patched globals, timers) and stay stopped,
      // so isRunning() is truthful and a later start() can try again (C20).
      this.running = false
      this.teardown()
      throw error
    }
  }

  stop(): void {
    if (!this.running) return
    this.running = false
    const error = this.teardown()
    if (error !== undefined) throw error
  }

  getSnapshot(): VibeSnapshot {
    const frameRate: FrameRateStats =
      this.frameRateCollector?.getStats() ?? EMPTY_FRAME_RATE_STATS
    const longFrames: LongFrameStats =
      this.longFrameCollector?.getStats() ?? EMPTY_LONG_FRAME_STATS
    const webVitals: WebVitalsStats =
      this.webVitalsCollector?.getStats() ?? EMPTY_WEB_VITALS
    const memory: HeapMemory | null =
      this.memoryCollector?.getStats() ?? null
    const resources: ResourceStats =
      this.resourceCollector?.getStats() ?? EMPTY_RESOURCE_STATS
    const consoleStats: ConsoleStats =
      this.consoleCollector?.getStats() ?? EMPTY_CONSOLE_STATS

    const issues = this.collectIssues()
    const startedAt = this.engineStartedAt
    // Which detectors looked, and when (C1): the hub only reads an issue's
    // absence as a fix from a detector that evaluated after the request.
    const detectors = startedAt === null
      ? null
      : this.detectors.map((detector) => detector.getStatus?.() ?? fallbackStatus(detector.name, startedAt))
    // Taken after the statuses so no evaluatedAt is later than the snapshot.
    const timestamp = Date.now()

    const raw: VibeSnapshot = {
      timestamp,
      frameRate,
      longFrames,
      webVitals,
      memory,
      resources,
      console: consoleStats,
      issues,
      domNodeCount: this.cachedDomNodeCount,
      ...(startedAt !== null && detectors !== null ? { engineStartedAt: startedAt, detectors } : {}),
    }
    // Issue caps and field clamps (C2); anything dropped is listed in
    // snapshot.truncation so its absence is never read as a fix.
    return boundSnapshot(raw)
  }

  getIssues(): readonly VibeIssue[] {
    return boundIssues(this.collectIssues()).issues
  }

  clearIssues(detector?: DetectorName): void {
    for (const d of this.detectors) {
      if (detector === undefined || d.name === detector) d.clear()
    }
  }

  recheck(detector: DetectorName): Promise<void> {
    return this.recheckMany([detector])
  }

  getAuditRun(detector: AuditDetectorName): AuditRun | null {
    return this.findDetector(detector)?.getAuditRun?.() ?? null
  }

  onSnapshot(callback: SnapshotCallback): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  isRunning(): boolean {
    return this.running
  }

  // Real delivery status of the beacon, or null when no beaconUrl is configured.
  getBeaconStatus(): BeaconStatus | null {
    return this.beaconClient?.getStatus() ?? null
  }

  dispatchIssue(issue: VibeIssue): Promise<DispatchIssueResponse> {
    if (this.beaconClient) return this.beaconClient.dispatchIssue(issue)
    return Promise.resolve({
      ok: false,
      code: 'unconfigured',
      projectId: this.config.projectId ?? '',
      queueDepth: 0,
    })
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  private startAll(): void {
    // Start collectors
    this.frameRateCollector = new FrameRateCollector()
    this.frameRateCollector.start()

    this.longFrameCollector = new LongFrameCollector()
    this.longFrameCollector.start()

    this.memoryCollector = new MemoryCollector()
    this.memoryCollector.start()

    this.webVitalsCollector = new WebVitalsCollector()
    this.webVitalsCollector.start()

    this.resourceCollector = new ResourceCollector()
    this.resourceCollector.start()

    this.consoleCollector = new ConsoleCollector()
    this.consoleCollector.start()

    // Cache DOM node count on a slower interval (every 2s) to avoid a
    // querySelectorAll('*') per snapshot tick. Initialize BEFORE detectors start
    // so domBloat's immediate check reads the real count via the shared sampler
    // rather than triggering its own scan.
    this.cachedDomNodeCount = countPageElements()
    this.domCountIntervalId = setInterval(() => {
      this.cachedDomNodeCount = countPageElements()
    }, DOM_COUNT_INTERVAL_MS)

    // Start enabled detectors, all in one batch.
    this.factories = this.createFactories()
    const batch = createRunBatch()
    for (const create of this.factories.values()) {
      const detector = create(batch)
      this.detectors = [...this.detectors, detector]
      detector.start()
    }

    // Start beacon if configured
    if (this.config.beaconUrl) {
      this.beaconClient = new BeaconClient({
        url: this.config.beaconUrl,
        intervalMs: this.config.beaconIntervalMs,
        projectId: this.config.projectId,
      })
      this.beaconClient.start(() => this.getSnapshot())
    }

    // Periodically notify listeners (every 500ms)
    this.snapshotIntervalId = setInterval(() => {
      const snapshot = this.getSnapshot()
      for (const listener of this.listeners) {
        listener(snapshot)
      }
    }, SNAPSHOT_NOTIFY_INTERVAL_MS)

    this.installNavigationHooks()
  }

  // Stops everything that is running. Every step runs even when an earlier one
  // throws, so no patched global is left behind; the first error is returned.
  private teardown(): unknown {
    let firstError: unknown = undefined
    const attempt = (step: () => void): void => {
      try {
        step()
      } catch (error) {
        if (firstError === undefined) firstError = error
      }
    }

    attempt(() => this.restoreNavigation?.())
    this.restoreNavigation = null
    if (this.routeTimerId !== undefined) clearTimeout(this.routeTimerId)
    this.routeTimerId = undefined
    this.routeRecheckPending = false
    this.lastAuditedUrl = null

    // Stop snapshot interval
    if (this.snapshotIntervalId !== undefined) {
      clearInterval(this.snapshotIntervalId)
      this.snapshotIntervalId = undefined
    }

    // Stop DOM count interval
    if (this.domCountIntervalId !== undefined) {
      clearInterval(this.domCountIntervalId)
      this.domCountIntervalId = undefined
    }

    // Tear down in reverse (LIFO) of start order: detectors were started after
    // collectors, and some of both monkey-patch the same globals (console,
    // fetch). Unwinding detectors first — then collectors — guarantees each
    // patch is removed from the top down, restoring the host's real globals.
    const started = this.detectors
    this.detectors = []
    this.factories = new Map()
    for (let i = started.length - 1; i >= 0; i--) {
      const detector = started[i]
      if (detector !== undefined) attempt(() => detector.stop())
    }

    // Stop collectors
    const consoleCollector = this.consoleCollector
    const resourceCollector = this.resourceCollector
    const webVitalsCollector = this.webVitalsCollector
    const memoryCollector = this.memoryCollector
    const longFrameCollector = this.longFrameCollector
    const frameRateCollector = this.frameRateCollector
    attempt(() => consoleCollector?.stop())
    attempt(() => resourceCollector?.stop())
    attempt(() => webVitalsCollector?.stop())
    attempt(() => memoryCollector?.stop())
    attempt(() => longFrameCollector?.stop())
    attempt(() => frameRateCollector?.stop())

    this.frameRateCollector = null
    this.longFrameCollector = null
    this.memoryCollector = null
    this.webVitalsCollector = null
    this.resourceCollector = null
    this.consoleCollector = null

    // Stop beacon
    const beaconClient = this.beaconClient
    attempt(() => beaconClient?.stop())
    this.beaconClient = null
    this.engineStartedAt = null
    return firstError
  }

  // Enabled detectors in their fixed start order.
  private createFactories(): ReadonlyMap<DetectorName, DetectorFactory> {
    const enabled = this.config.detectors
    const entries: ReadonlyArray<readonly [boolean, DetectorName, DetectorFactory]> = [
      // domBloat reuses the engine's cached DOM node count instead of running a
      // second full-DOM scan; only its periodic depth walk remains its own work.
      [enabled.domBloat, 'dom-bloat', () => createDomBloatDetector(() => this.cachedDomNodeCount)],
      [enabled.duplicateRequests, 'duplicate-requests', () => createDuplicateRequestsDetector(
        this.config.beaconUrl ? [this.config.beaconUrl] : [],
      )],
      [enabled.consoleSpam, 'console-spam', () => createConsoleSpamDetector()],
      [enabled.memoryLeak, 'memory-leak', () => createMemoryLeakDetector()],
      [enabled.layoutThrashing, 'layout-thrashing', () => createLayoutThrashingDetector()],
      [enabled.unoptimizedImages, 'unoptimized-images', () => createUnoptimizedImagesDetector()],
      [enabled.longTaskAttribution, 'long-task-attribution', () => createLongTaskAttributionDetector()],
      [enabled.resourceBloat, 'resource-bloat', () => createResourceBloatDetector()],
      [enabled.largeImages, 'large-images', () => createLargeImagesDetector()],
      [enabled.webEssentials, 'web-essentials', () => createWebEssentialsDetector()],
      [enabled.heavyLibrary, 'heavy-library', () => createHeavyLibraryDetector()],
      [enabled.seo, 'seo', () => createSeoDetector()],
      [enabled.aeo, 'aeo', () => createAeoDetector()],
    ]
    return new Map(
      entries
        .filter(([isEnabled]) => isEnabled)
        .map(([, name, create]) => [name, create] as const),
    )
  }

  private collectIssues(): readonly VibeIssue[] {
    const out: VibeIssue[] = []
    for (const detector of this.detectors) {
      const detectorIssues = detector.getIssues()
      for (let i = 0; i < detectorIssues.length; i++) {
        out.push(detectorIssues[i]!)
      }
    }
    return out
  }

  private findDetector(name: DetectorName): Detector | undefined {
    return this.detectors.find((detector) => detector.name === name)
  }

  // ── Recheck (SPEC-P2) ─────────────────────────────────────────────────────

  // Replaces each named detector with a fresh instance (stop → new, cleared
  // state → start) in its original position, all in one batch, then waits for
  // them to settle. Audits get a fresh probe cache, so an HMR fix is re-read
  // rather than answered from the previous run.
  private recheckMany(names: readonly DetectorName[]): Promise<void> {
    if (!this.running) return Promise.resolve()
    const batch = createRunBatch()
    const restarted: DetectorName[] = []
    for (const name of names) {
      const create = this.factories.get(name)
      const index = this.detectors.findIndex((detector) => detector.name === name)
      const previous = this.detectors[index]
      if (create === undefined || previous === undefined) continue
      try {
        previous.stop()
      } catch {
        // Its patches may still be installed: do not stack a second instance on top.
        continue
      }
      const next = create(batch)
      this.detectors = this.detectors.map((detector, position) => (position === index ? next : detector))
      restarted.push(name)
      try {
        next.start()
      } catch {
        // It stays in the list, so stop() still tears it down; recheck resolves
        // on the timeout instead of rejecting into a caller that fired and forgot.
      }
    }
    if (restarted.length === 0) return Promise.resolve()
    return this.waitForSettled(restarted)
  }

  private waitForSettled(names: readonly DetectorName[]): Promise<void> {
    const deadline = Date.now() + RECHECK_TIMEOUT_MS
    return new Promise<void>((resolve) => {
      const poll = (): void => {
        const done = !this.running
          || Date.now() >= deadline
          || names.every((name) => {
            // Looked up each time: a newer recheck may have replaced the instance.
            const detector = this.findDetector(name)
            return detector === undefined || hasSettled(detector)
          })
        if (done) {
          resolve()
          return
        }
        setTimeout(poll, RECHECK_POLL_MS)
      }
      poll()
    })
  }

  // ── SPA navigation (C15) ──────────────────────────────────────────────────

  private enabledAudits(): readonly AuditDetectorName[] {
    return AUDIT_DETECTORS.filter((name) => this.factories.has(name))
  }

  // Audits read the DOM of one route. On a client-side navigation they are
  // re-run for the new route (debounced), and the previous route's results are
  // dropped at once so they are never reported under the new URL.
  private installNavigationHooks(): void {
    if (this.enabledAudits().length === 0) return
    if (typeof window.history === 'undefined') return
    const history = window.history
    const onNavigate = this.handleNavigation
    const originalPush = history.pushState
    const originalReplace = history.replaceState
    const patchedPush = function (this: History, data: unknown, unused: string, url?: string | URL | null): void {
      originalPush.call(this, data, unused, url)
      onNavigate()
    }
    const patchedReplace = function (this: History, data: unknown, unused: string, url?: string | URL | null): void {
      originalReplace.call(this, data, unused, url)
      onNavigate()
    }
    this.lastAuditedUrl = normalizePageUrl(window.location.href)
    history.pushState = patchedPush
    history.replaceState = patchedReplace
    window.addEventListener('popstate', onNavigate)
    this.restoreNavigation = () => {
      // Ownership check: if something patched history on top of us, leave its
      // wrapper in place (it still calls ours, which is now inert).
      if (history.pushState === patchedPush) history.pushState = originalPush
      if (history.replaceState === patchedReplace) history.replaceState = originalReplace
      window.removeEventListener('popstate', onNavigate)
    }
  }

  // Never throws: it runs inside the host app's own navigation call.
  private readonly handleNavigation = (): void => {
    try {
      if (!this.running) return
      const url = normalizePageUrl(window.location.href)
      if (url === this.lastAuditedUrl && !this.routeRecheckPending) return
      if (!this.routeRecheckPending) {
        this.routeRecheckPending = true
        for (const name of this.enabledAudits()) this.clearIssues(name)
      }
      if (this.routeTimerId !== undefined) clearTimeout(this.routeTimerId)
      this.routeTimerId = setTimeout(this.runRouteRecheck, ROUTE_RECHECK_DEBOUNCE_MS)
    } catch {
      // A monitoring hook must not break the app's routing.
    }
  }

  private readonly runRouteRecheck = (): void => {
    this.routeTimerId = undefined
    this.routeRecheckPending = false
    if (!this.running) return
    this.lastAuditedUrl = normalizePageUrl(window.location.href)
    void this.recheckMany(this.enabledAudits())
  }
}
