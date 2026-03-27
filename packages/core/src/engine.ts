import type {
  VibeSnapshot,
  VibeIssue,
  VibeCheckConfig,
  Detector,
  FrameRateStats,
  LongFrameStats,
  WebVitalsStats,
  HeapMemory,
  ResourceStats,
  ConsoleStats,
} from './types.js'
import {
  EMPTY_FRAME_RATE_STATS,
  EMPTY_LONG_FRAME_STATS,
  EMPTY_WEB_VITALS,
  EMPTY_RESOURCE_STATS,
  EMPTY_CONSOLE_STATS,
  DEFAULT_CONFIG,
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
import { BeaconClient } from './beacon/beaconClient.js'

type SnapshotCallback = (snapshot: VibeSnapshot) => void

export class VibeCheckEngine {
  private readonly config: VibeCheckConfig
  private running = false

  // Collectors
  private frameRateCollector: FrameRateCollector | null = null
  private longFrameCollector: LongFrameCollector | null = null
  private memoryCollector: MemoryCollector | null = null
  private webVitalsCollector: WebVitalsCollector | null = null
  private resourceCollector: ResourceCollector | null = null
  private consoleCollector: ConsoleCollector | null = null

  // Detectors
  private readonly detectors: Detector[] = []

  // Beacon
  private beaconClient: BeaconClient | null = null

  // Callbacks
  private readonly listeners: Set<SnapshotCallback> = new Set()

  // DOM node count (cached, updated on its own interval)
  private cachedDomNodeCount = 0
  private domCountIntervalId: ReturnType<typeof setInterval> | undefined = undefined

  // Snapshot update interval
  private snapshotIntervalId: ReturnType<typeof setInterval> | undefined = undefined

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
    this.running = true

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

    // Start enabled detectors
    const detectorConfig = this.config.detectors

    const detectorFactories: Array<[boolean, () => Detector]> = [
      [detectorConfig.domBloat, createDomBloatDetector],
      [detectorConfig.duplicateRequests, createDuplicateRequestsDetector],
      [detectorConfig.consoleSpam, createConsoleSpamDetector],
      [detectorConfig.memoryLeak, createMemoryLeakDetector],
      [detectorConfig.layoutThrashing, createLayoutThrashingDetector],
      [detectorConfig.unoptimizedImages, createUnoptimizedImagesDetector],
      [detectorConfig.longTaskAttribution, createLongTaskAttributionDetector],
      [detectorConfig.resourceBloat, createResourceBloatDetector],
      [detectorConfig.largeImages, createLargeImagesDetector],
      [detectorConfig.webEssentials, createWebEssentialsDetector],
    ]

    for (const [enabled, factory] of detectorFactories) {
      if (enabled) {
        const d = factory()
        d.start()
        this.detectors.push(d)
      }
    }

    // Start beacon if configured
    if (this.config.beaconUrl) {
      this.beaconClient = new BeaconClient({
        url: this.config.beaconUrl,
        intervalMs: this.config.beaconIntervalMs,
      })
      this.beaconClient.start(() => this.getSnapshot())
    }

    // Cache DOM node count on a slower interval (every 2s) to avoid querySelectorAll('*') perf hit
    if (typeof document !== 'undefined') {
      this.cachedDomNodeCount = document.querySelectorAll('*').length
      this.domCountIntervalId = setInterval(() => {
        this.cachedDomNodeCount = document.querySelectorAll('*').length
      }, 2000)
    }

    // Periodically notify listeners (every 500ms)
    this.snapshotIntervalId = setInterval(() => {
      const snapshot = this.getSnapshot()
      for (const listener of this.listeners) {
        listener(snapshot)
      }
    }, 500)
  }

  stop(): void {
    if (!this.running) return
    this.running = false

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

    // Stop collectors
    this.frameRateCollector?.stop()
    this.longFrameCollector?.stop()
    this.memoryCollector?.stop()
    this.webVitalsCollector?.stop()
    this.resourceCollector?.stop()
    this.consoleCollector?.stop()

    this.frameRateCollector = null
    this.longFrameCollector = null
    this.memoryCollector = null
    this.webVitalsCollector = null
    this.resourceCollector = null
    this.consoleCollector = null

    // Stop detectors
    for (const d of this.detectors) {
      d.stop()
    }
    ;(this.detectors as Detector[]).splice(0)

    // Stop beacon
    this.beaconClient?.stop()
    this.beaconClient = null
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

    const issues: readonly VibeIssue[] = this.detectors.flatMap((d) =>
      [...d.getIssues()]
    )

    const domNodeCount = this.cachedDomNodeCount

    return {
      timestamp: Date.now(),
      frameRate,
      longFrames,
      webVitals,
      memory,
      resources,
      console: consoleStats,
      issues,
      domNodeCount,
    }
  }

  getIssues(): readonly VibeIssue[] {
    return this.detectors.flatMap((d) => [...d.getIssues()])
  }

  clearIssues(): void {
    for (const d of this.detectors) {
      d.clear()
    }
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
}
