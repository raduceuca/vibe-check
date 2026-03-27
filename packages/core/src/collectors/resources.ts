import type { ResourceStats, LargeResource, Collector } from '../types.js'
import { EMPTY_RESOURCE_STATS } from '../types.js'
import { hasResourceTiming } from '../utils/featureDetect.js'

const LARGE_RESOURCE_THRESHOLD_KB = 100
const POLL_INTERVAL_MS = 5000

interface ResourceEntry {
  readonly name: string
  readonly transferSize: number
  readonly initiatorType: string
}

const classifyType = (initiatorType: string): 'js' | 'css' | 'image' | 'font' | 'other' => {
  switch (initiatorType) {
    case 'script':
      return 'js'
    case 'link':
    case 'css':
      return 'css'
    case 'img':
      return 'image'
    case 'font':
      return 'font'
    default:
      return 'other'
  }
}

const buildStats = (entries: readonly ResourceEntry[]): ResourceStats => {
  let totalTransferKB = 0
  let jsTransferKB = 0
  let cssTransferKB = 0
  let imageTransferKB = 0
  let fontTransferKB = 0
  const largeResources: LargeResource[] = []

  for (const entry of entries) {
    const sizeKB = entry.transferSize / 1024
    totalTransferKB += sizeKB

    const type = classifyType(entry.initiatorType)
    switch (type) {
      case 'js':
        jsTransferKB += sizeKB
        break
      case 'css':
        cssTransferKB += sizeKB
        break
      case 'image':
        imageTransferKB += sizeKB
        break
      case 'font':
        fontTransferKB += sizeKB
        break
    }

    if (sizeKB > LARGE_RESOURCE_THRESHOLD_KB) {
      largeResources.push({
        url: entry.name,
        transferSizeKB: sizeKB,
        type: type === 'other' ? entry.initiatorType : type,
      })
    }
  }

  return {
    totalTransferKB,
    jsTransferKB,
    cssTransferKB,
    imageTransferKB,
    fontTransferKB,
    resourceCount: entries.length,
    largeResources,
  }
}

export class ResourceCollector implements Collector<ResourceStats> {
  private readonly entries: ResourceEntry[] = []
  private readonly seenUrls: Set<string> = new Set()
  private observer: PerformanceObserver | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private readonly listeners: Set<(stats: ResourceStats) => void> = new Set()

  start(): void {
    if (!hasResourceTiming()) return

    // Initial scan of already-loaded resources
    this.scanExistingEntries()

    // Observe new resource entries
    this.observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as readonly ResourceEntry[]
      this.addEntries(entries)
      this.notify()
    })

    this.observer.observe({ type: 'resource', buffered: true })

    // Poll every 5s to catch entries that may have been missed
    this.pollTimer = setInterval(() => {
      this.scanExistingEntries()
      this.notify()
    }, POLL_INTERVAL_MS)
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  getStats(): ResourceStats {
    if (this.entries.length === 0) {
      return EMPTY_RESOURCE_STATS
    }
    return buildStats(this.entries)
  }

  onUpdate(callback: (stats: ResourceStats) => void): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notify(): void {
    const stats = this.getStats()
    for (const cb of this.listeners) {
      cb(stats)
    }
  }

  private scanExistingEntries(): void {
    const entries = performance.getEntriesByType('resource') as unknown as readonly ResourceEntry[]
    this.addEntries(entries)
  }

  private addEntries(entries: readonly ResourceEntry[]): void {
    for (const entry of entries) {
      if (!this.seenUrls.has(entry.name)) {
        this.seenUrls.add(entry.name)
        this.entries.push({
          name: entry.name,
          transferSize: entry.transferSize,
          initiatorType: entry.initiatorType,
        })
      }
    }
  }
}
