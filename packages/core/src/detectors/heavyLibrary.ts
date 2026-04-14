import type { Detector, VibeIssue } from '../types.js'
import { createIssue } from './createIssue.js'

// ── Library Signatures ──────────────────────────────────────────────────────

interface LibrarySignature {
  readonly name: string
  readonly packageName: string
  readonly category: 'animation' | 'ui-framework' | 'charting' | 'css-in-js' | '3d' | 'utility' | 'date'
  readonly bundleSizeKB: number
  readonly globals: readonly string[]
  readonly domPatterns: readonly string[]
  readonly scriptPatterns: readonly string[]
  readonly riskLevel: 'high' | 'medium' | 'low'
  readonly issues: readonly string[]
  readonly vibeDescription: string
}

const LIBRARY_SIGNATURES: readonly LibrarySignature[] = [
  {
    name: 'Three.js',
    packageName: 'three',
    category: '3d',
    bundleSizeKB: 176,
    globals: ['THREE'],
    domPatterns: ['canvas[data-engine^="three"]'],
    scriptPatterns: ['three.module', 'three.min.js', 'three.js'],
    riskLevel: 'high',
    issues: [
      'GPU memory leaks from undisposed geometries/materials/textures',
      'Render loops running when tab is not visible',
      'Uncompressed 3D models (no Draco/KTX2)',
      'No instancing for repeated geometries',
    ],
    vibeDescription: '3D engine that eats GPU memory if you forget to clean up',
  },
  {
    name: 'Framer Motion',
    packageName: 'framer-motion',
    category: 'animation',
    bundleSizeKB: 58,
    globals: [],
    domPatterns: ['[data-framer-appear-id]', '[data-projection-id]'],
    scriptPatterns: ['framer-motion', 'motion/react'],
    riskLevel: 'high',
    issues: [
      'JS-driven animations competing with React renders on main thread',
      'layout prop triggers getBoundingClientRect on every frame',
      'AnimatePresence with many children causes expensive calculations',
      'Not using LazyMotion — shipping full 58KB instead of ~5KB',
    ],
    vibeDescription: 'Animation library running expensive layout reads every frame',
  },
  {
    name: 'GSAP',
    packageName: 'gsap',
    category: 'animation',
    bundleSizeKB: 27,
    globals: ['gsap', 'GreenSockGlobals'],
    domPatterns: [],
    scriptPatterns: ['gsap', 'greensock'],
    riskLevel: 'medium',
    issues: [
      'Timelines/tweens not killed on component unmount leak memory',
      'ScrollTrigger accumulates listeners on SPA navigation',
      'Animating layout properties (width/height) instead of transforms',
    ],
    vibeDescription: 'Animation library that leaks memory if animations aren\'t cleaned up',
  },
  {
    name: 'Lottie',
    packageName: 'lottie-web',
    category: 'animation',
    bundleSizeKB: 75,
    globals: ['lottie', 'bodymovin'],
    domPatterns: [],
    scriptPatterns: ['lottie', 'bodymovin'],
    riskLevel: 'high',
    issues: [
      'SVG renderer creates massive DOM trees from complex animations',
      'Each frame updates SVG causing layout recalculation',
      'Animations not destroyed on unmount',
      'Full library loaded instead of lottie_light',
    ],
    vibeDescription: 'Animation player creating hundreds of hidden elements for each animation',
  },
  {
    name: 'Moment.js',
    packageName: 'moment',
    category: 'date',
    bundleSizeKB: 75,
    globals: ['moment'],
    domPatterns: [],
    scriptPatterns: ['moment.min.js', 'moment-with-locales'],
    riskLevel: 'high',
    issues: [
      'Deprecated library — not tree-shakable, ships all locales (67KB)',
      'Entire 75KB library loads even for simple date formatting',
      'Use dayjs (2KB) or native Intl.DateTimeFormat instead',
    ],
    vibeDescription: 'Outdated date library adding 75KB of dead weight to your page',
  },
  {
    name: 'Lodash (full)',
    packageName: 'lodash',
    category: 'utility',
    bundleSizeKB: 25,
    globals: ['_'],
    domPatterns: [],
    scriptPatterns: ['lodash.min.js', 'lodash.core'],
    riskLevel: 'medium',
    issues: [
      'Full import ships entire library (25KB gzip) even for one function',
      'Not tree-shakable (CommonJS) — use lodash-es instead',
      'Many functions duplicate native JS methods',
    ],
    vibeDescription: 'Utility library shipping 25KB when you probably only need one function',
  },
  {
    name: 'styled-components',
    packageName: 'styled-components',
    category: 'css-in-js',
    bundleSizeKB: 12,
    globals: [],
    domPatterns: ['style[data-styled="active"]', '[class*="sc-"]'],
    scriptPatterns: ['styled-components'],
    riskLevel: 'medium',
    issues: [
      'Runtime style generation on every render (2x slower than static CSS)',
      'Extra React wrapper components per styled element',
      'Style injection causes flash of unstyled content during SSR',
      'Dynamic props force style recalculation each render',
    ],
    vibeDescription: 'CSS library that recalculates styles on every update, slowing things down',
  },
  {
    name: 'Material UI',
    packageName: '@mui/material',
    category: 'ui-framework',
    bundleSizeKB: 80,
    globals: [],
    domPatterns: ['[class*="MuiButton"]', '[class*="MuiPaper"]', '[class*="Mui"]', 'style[data-emotion]'],
    scriptPatterns: ['@mui/material', 'mui'],
    riskLevel: 'high',
    issues: [
      'Runtime CSS-in-JS via Emotion — per-render style injection',
      'Heavy DOM output (single Select = 15+ nested nodes)',
      'Icon imports can add megabytes if not tree-shaken',
      'ThemeProvider re-renders propagate to all styled children',
    ],
    vibeDescription: 'UI kit generating complex markup and recalculating styles constantly',
  },
  {
    name: 'Ant Design',
    packageName: 'antd',
    category: 'ui-framework',
    bundleSizeKB: 350,
    globals: [],
    domPatterns: ['[class*="ant-btn"]', '[class*="ant-table"]', '[class*="ant-"]'],
    scriptPatterns: ['antd'],
    riskLevel: 'high',
    issues: [
      'Enormous bundle (350KB gzip) with 48 dependencies',
      'Runtime CSS-in-JS style generation',
      'Tree-shaking failures with ConfigProvider',
      'Heavy DOM structures for tables, selects, date pickers',
    ],
    vibeDescription: 'Massive UI kit adding 350KB — heavier than most entire apps should be',
  },
  {
    name: 'D3.js',
    packageName: 'd3',
    category: 'charting',
    bundleSizeKB: 90,
    globals: ['d3'],
    domPatterns: ['svg .tick', 'svg .axis', 'svg .domain'],
    scriptPatterns: ['d3.min.js', 'd3.js'],
    riskLevel: 'medium',
    issues: [
      'SVG rendering creates one DOM node per data point — jank at 1000+ elements',
      'Full umbrella import (90KB) when sub-packages would suffice',
      'Frequent DOM mutations from enter-update-exit pattern',
    ],
    vibeDescription: 'Chart library creating thousands of elements that slow down your page',
  },
  {
    name: 'Chart.js',
    packageName: 'chart.js',
    category: 'charting',
    bundleSizeKB: 67,
    globals: ['Chart'],
    domPatterns: [],
    scriptPatterns: ['chart.js', 'chart.min.js', 'chart.umd'],
    riskLevel: 'medium',
    issues: [
      'Full chart destruction and recreation on data updates',
      'Struggles with 10K+ data points',
      'Full library import instead of registering needed chart types',
    ],
    vibeDescription: 'Chart library that redraws everything from scratch on each update',
  },
  {
    name: 'AOS (Animate on Scroll)',
    packageName: 'aos',
    category: 'animation',
    bundleSizeKB: 6,
    globals: ['AOS'],
    domPatterns: ['[data-aos]', '[data-aos-duration]'],
    scriptPatterns: ['aos.js', 'aos.min.js'],
    riskLevel: 'medium',
    issues: [
      'Uses scroll event listeners instead of IntersectionObserver',
      'Event listeners leak on SPA navigation (no destroy method)',
      'Ships all animation CSS definitions whether used or not',
    ],
    vibeDescription: 'Scroll animation library using outdated techniques that slow scrolling',
  },
  {
    name: 'Anime.js',
    packageName: 'animejs',
    category: 'animation',
    bundleSizeKB: 7,
    globals: ['anime'],
    domPatterns: [],
    scriptPatterns: ['anime.min.js', 'animejs'],
    riskLevel: 'low',
    issues: [
      'No built-in cleanup for framework integration',
      'Layout-triggering property animations if misused',
    ],
    vibeDescription: 'Animation library that can cause jank if animating the wrong properties',
  },
  {
    name: 'Swiper',
    packageName: 'swiper',
    category: 'animation',
    bundleSizeKB: 20,
    globals: ['Swiper'],
    domPatterns: ['.swiper', '.swiper-container', '.swiper-slide'],
    scriptPatterns: ['swiper-bundle', 'swiper'],
    riskLevel: 'medium',
    issues: [
      'Full bundle import includes all modules unnecessarily',
      'Loop mode clones all slides doubling DOM weight',
      'Touch handlers fire on every move event without throttling',
    ],
    vibeDescription: 'Slider library duplicating your content and handling every touch event',
  },
  {
    name: 'React Spring',
    packageName: '@react-spring/web',
    category: 'animation',
    bundleSizeKB: 19,
    globals: [],
    domPatterns: [],
    scriptPatterns: ['react-spring'],
    riskLevel: 'medium',
    issues: [
      'Physics calculations run on every frame via JavaScript',
      'Complex spring chains saturate main thread',
    ],
    vibeDescription: 'Physics animation library doing heavy math on every frame',
  },
  {
    name: 'Emotion',
    packageName: '@emotion/react',
    category: 'css-in-js',
    bundleSizeKB: 11,
    globals: [],
    domPatterns: ['style[data-emotion]', '[class*="css-"]'],
    scriptPatterns: ['@emotion/react', '@emotion/styled'],
    riskLevel: 'medium',
    issues: [
      'Runtime CSS-in-JS overhead (2x slower than static CSS)',
      'css prop with dynamic values creates new rules on every change',
      'Compounds with MUI overhead',
    ],
    vibeDescription: 'CSS library creating new style rules on every render cycle',
  },
]

// ── Detection Helpers ───────────────────────────────────────────────────────

const checkGlobals = (globals: readonly string[]): boolean => {
  if (typeof window === 'undefined') return false
  return globals.some((g) => g in window)
}

const checkDomPatterns = (patterns: readonly string[]): boolean => {
  if (typeof document === 'undefined') return false
  return patterns.some((selector) => {
    try {
      return document.querySelector(selector) !== null
    } catch {
      return false
    }
  })
}

const checkScriptPatterns = (patterns: readonly string[]): boolean => {
  if (typeof document === 'undefined') return false

  const scripts = document.querySelectorAll('script[src]')
  const lowerPatterns = patterns.map((p) => p.toLowerCase())

  for (const script of scripts) {
    const src = (script as HTMLScriptElement).src.toLowerCase()
    if (lowerPatterns.some((pattern) => src.includes(pattern))) return true
  }

  // Also check performance resource entries for bundled libraries
  if (typeof performance !== 'undefined') {
    const resources = performance.getEntriesByType('resource')
    for (const entry of resources) {
      const name = entry.name.toLowerCase()
      if (
        lowerPatterns.some((pattern) => name.includes(pattern)) &&
        (name.endsWith('.js') || name.endsWith('.mjs') || name.includes('.js?'))
      ) {
        return true
      }
    }
  }

  return false
}

interface DetectedLibrary {
  readonly signature: LibrarySignature
  readonly detectedVia: 'global' | 'dom' | 'script'
}

const detectLibrary = (sig: LibrarySignature): DetectedLibrary | null => {
  if (checkGlobals(sig.globals)) return { signature: sig, detectedVia: 'global' }
  if (checkDomPatterns(sig.domPatterns)) return { signature: sig, detectedVia: 'dom' }
  if (checkScriptPatterns(sig.scriptPatterns)) return { signature: sig, detectedVia: 'script' }
  return null
}

// ── Severity mapping ────────────────────────────────────────────────────────

const riskToSeverity = (risk: 'high' | 'medium' | 'low'): 'warning' | 'info' => {
  if (risk === 'high') return 'warning'
  return 'info'
}

// ── Category labels ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<LibrarySignature['category'], string> = {
  animation: 'Animation',
  'ui-framework': 'UI Framework',
  charting: 'Charting',
  'css-in-js': 'CSS-in-JS',
  '3d': '3D / WebGL',
  utility: 'Utility',
  date: 'Date',
}

// ── Detector ────────────────────────────────────────────────────────────────

const SCAN_DELAY_MS = 3_000
const RESCAN_INTERVAL_MS = 30_000

export const createHeavyLibraryDetector = (): Detector => {
  let issues: VibeIssue[] = []
  let initialTimeoutId: ReturnType<typeof setTimeout> | null = null
  let rescanIntervalId: ReturnType<typeof setInterval> | null = null
  const reportedLibraries = new Set<string>()

  const scan = (): void => {
    // Skip the entire scan (and its DOM + resource queries) when every known
    // signature has already been reported, or when the page is hidden.
    if (reportedLibraries.size === LIBRARY_SIGNATURES.length) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    for (const sig of LIBRARY_SIGNATURES) {
      if (reportedLibraries.has(sig.packageName)) continue

      const detected = detectLibrary(sig)
      if (!detected) continue

      reportedLibraries.add(sig.packageName)

      const issueList = sig.issues.map((i) => `\u2022 ${i}`).join('\n')
      const category = CATEGORY_LABELS[sig.category]

      issues = [
        ...issues,
        createIssue(
          'heavy-library',
          riskToSeverity(sig.riskLevel),
          `${sig.name} detected (${sig.bundleSizeKB}KB)`,
          `${category} library "${sig.name}" (${sig.packageName}) found on page.\n\nKnown performance risks:\n${issueList}`,
          {
            library: sig.name,
            packageName: sig.packageName,
            category: sig.category,
            bundleSizeKB: sig.bundleSizeKB,
            riskLevel: sig.riskLevel,
            detectedVia: detected.detectedVia,
            knownIssues: sig.issues,
            vibeDescription: sig.vibeDescription,
          },
        ),
      ]
    }
  }

  return {
    name: 'heavy-library',

    start(): void {
      // Delay initial scan to let page load fully
      initialTimeoutId = setTimeout(() => {
        scan()
        // Periodic rescan for lazily loaded libraries
        rescanIntervalId = setInterval(scan, RESCAN_INTERVAL_MS)
      }, SCAN_DELAY_MS)
    },

    stop(): void {
      if (initialTimeoutId !== null) {
        clearTimeout(initialTimeoutId)
        initialTimeoutId = null
      }
      if (rescanIntervalId !== null) {
        clearInterval(rescanIntervalId)
        rescanIntervalId = null
      }
      reportedLibraries.clear()
    },

    getIssues(): readonly VibeIssue[] {
      return issues
    },

    clear(): void {
      issues = []
      reportedLibraries.clear()
    },
  }
}

// Export signatures for use by suggestions system
export { LIBRARY_SIGNATURES }
export type { LibrarySignature }
