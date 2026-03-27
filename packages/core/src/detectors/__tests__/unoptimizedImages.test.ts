import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createUnoptimizedImagesDetector } from '../unoptimizedImages.js'
import { resetIssueCounter } from '../createIssue.js'

// ── Mock MutationObserver ────────────────────────────────────────────────────

let mutationCallback: MutationCallback | null = null
let observerDisconnected = false

class MockMutationObserver {
  constructor(cb: MutationCallback) {
    mutationCallback = cb
  }
  observe() {
    observerDisconnected = false
  }
  disconnect() {
    observerDisconnected = true
    mutationCallback = null
  }
  takeRecords() {
    return []
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const createMockImage = (options: {
  src?: string
  loading?: string | null
  width?: string | null
  height?: string | null
  naturalWidth?: number
  renderedWidth?: number
  topOffset?: number
}): HTMLImageElement => {
  const img = document.createElement('img')

  if (options.src) img.src = options.src
  if (options.loading) img.setAttribute('loading', options.loading)
  if (options.width) img.setAttribute('width', options.width)
  if (options.height) img.setAttribute('height', options.height)

  // Mock getBoundingClientRect
  vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
    top: options.topOffset ?? 0,
    left: 0,
    bottom: (options.topOffset ?? 0) + 100,
    right: 100,
    width: options.renderedWidth ?? 100,
    height: 100,
    x: 0,
    y: options.topOffset ?? 0,
    toJSON: () => ({}),
  })

  // Mock natural dimensions
  Object.defineProperty(img, 'naturalWidth', {
    value: options.naturalWidth ?? 100,
    configurable: true,
  })
  Object.defineProperty(img, 'width', {
    value: options.renderedWidth ?? 100,
    configurable: true,
  })

  return img
}

const simulateAddedNodes = (nodes: Node[]): void => {
  if (!mutationCallback) return

  const records: MutationRecord[] = [
    {
      type: 'childList',
      addedNodes: nodes as unknown as NodeList,
      removedNodes: [] as unknown as NodeList,
      target: document.body,
      attributeName: null,
      attributeNamespace: null,
      nextSibling: null,
      previousSibling: null,
      oldValue: null,
    },
  ]

  mutationCallback(records, new MockMutationObserver(() => {}) as unknown as MutationObserver)
}

describe('unoptimizedImages detector', () => {
  beforeEach(() => {
    resetIssueCounter()
    mutationCallback = null
    observerDisconnected = false
    vi.stubGlobal('MutationObserver', MockMutationObserver)

    // Mock window.innerHeight
    Object.defineProperty(window, 'innerHeight', {
      value: 800,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should have the correct name', () => {
    const detector = createUnoptimizedImagesDetector()
    expect(detector.name).toBe('unoptimized-images')
  })

  it('should start with no issues', () => {
    const detector = createUnoptimizedImagesDetector()
    expect(detector.getIssues()).toEqual([])
  })

  it('should detect images missing loading="lazy" below the fold', () => {
    const img = createMockImage({
      src: 'https://example.com/photo.jpg',
      topOffset: 1200, // Below fold (window.innerHeight = 800)
      width: '200',
      height: '150',
    })

    // Mock querySelectorAll to return our image for initial scan
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [img] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    const issues = detector.getIssues()
    expect(issues.length).toBe(1)
    expect(issues[0].evidence).toHaveProperty('issue', 'missing-lazy')
    expect(issues[0].severity).toBe('warning')

    detector.stop()
  })

  it('should not flag images above the fold for missing lazy', () => {
    const img = createMockImage({
      src: 'https://example.com/hero.jpg',
      topOffset: 200, // Above fold
      width: '400',
      height: '300',
    })

    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [img] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    const lazyIssues = detector.getIssues().filter(
      (iss) => iss.evidence.issue === 'missing-lazy',
    )
    expect(lazyIssues).toEqual([])

    detector.stop()
  })

  it('should detect images missing width/height attributes', () => {
    const img = createMockImage({
      src: 'https://example.com/photo.jpg',
      topOffset: 200,
      // No width/height attributes
    })

    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [img] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    const dimIssues = detector.getIssues().filter(
      (iss) => iss.evidence.issue === 'missing-dimensions',
    )
    expect(dimIssues.length).toBe(1)
    expect(dimIssues[0].severity).toBe('error')

    detector.stop()
  })

  it('should detect oversized images (natural > 2x rendered)', () => {
    const img = createMockImage({
      src: 'https://example.com/big-photo.jpg',
      naturalWidth: 2000,
      renderedWidth: 400,
      width: '400',
      height: '300',
    })

    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [img] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    const oversizedIssues = detector.getIssues().filter(
      (iss) => iss.evidence.issue === 'oversized',
    )
    expect(oversizedIssues.length).toBe(1)
    expect(oversizedIssues[0].severity).toBe('warning')
    expect(oversizedIssues[0].evidence).toHaveProperty('naturalWidth', 2000)

    detector.stop()
  })

  it('should detect images added via MutationObserver', () => {
    // Start with no images
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    expect(detector.getIssues()).toEqual([])

    // Simulate adding an image via DOM mutation
    const img = createMockImage({
      src: 'https://example.com/dynamic.jpg',
      topOffset: 100,
      // No width/height — should trigger missing-dimensions
    })
    simulateAddedNodes([img])

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)

    detector.stop()
  })

  it('should detect images nested inside added containers', () => {
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    // Simulate adding a div that contains an image
    const container = document.createElement('div')
    const img = createMockImage({
      src: 'https://example.com/nested.jpg',
      topOffset: 100,
    })
    container.appendChild(img)

    simulateAddedNodes([container])

    const issues = detector.getIssues()
    expect(issues.length).toBeGreaterThanOrEqual(1)

    detector.stop()
  })

  it('should not report the same image+issue combo twice', () => {
    const img = createMockImage({
      src: 'https://example.com/photo.jpg',
      topOffset: 100,
    })

    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [img] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    const initialCount = detector.getIssues().length

    // Simulate the same image being added again
    simulateAddedNodes([img])

    expect(detector.getIssues().length).toBe(initialCount)

    detector.stop()
  })

  it('should disconnect observer on stop()', () => {
    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    expect(observerDisconnected).toBe(false)

    detector.stop()

    expect(observerDisconnected).toBe(true)
  })

  it('should clear issues', () => {
    const img = createMockImage({
      src: 'https://example.com/photo.jpg',
      topOffset: 100,
    })

    vi.spyOn(document, 'querySelectorAll').mockReturnValue(
      [img] as unknown as NodeListOf<Element>,
    )

    const detector = createUnoptimizedImagesDetector()
    detector.start()

    expect(detector.getIssues().length).toBeGreaterThanOrEqual(1)

    detector.clear()
    expect(detector.getIssues()).toEqual([])

    detector.stop()
  })

  it('should gracefully handle missing MutationObserver', () => {
    // Override MutationObserver to undefined via vi.stubGlobal
    vi.stubGlobal('MutationObserver', undefined)

    const detector = createUnoptimizedImagesDetector()
    detector.start() // Should not throw
    expect(detector.getIssues()).toEqual([])
    detector.stop()

    // Restore mock for other tests (afterEach unstubs all)
    vi.stubGlobal('MutationObserver', MockMutationObserver)
  })
})
