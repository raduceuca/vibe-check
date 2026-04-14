import type { DetectorName, VibeIssue } from '../types.js'

// ── Types ───────────────────────────────────────────────────────────────────

export type SuggestionMode = 'technical' | 'vibe'

export interface Suggestion {
  readonly title: string
  readonly explanation: string
  readonly prompt: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const getImageName = (evidence: Record<string, unknown>): string => {
  const src = typeof evidence['src'] === 'string' ? evidence['src'] as string : ''
  if (!src) return 'unknown image'
  // Extract readable filename from URL
  const path = src.split('?')[0].split('#')[0]
  const segments = path.split('/')
  const last = segments[segments.length - 1]
  // If it looks like a filename, use it; otherwise use last 2 path segments
  if (last && last.includes('.')) return last
  if (segments.length >= 2) return segments.slice(-2).join('/')
  return last || src.slice(0, 60)
}

// ── Dual-mode templates ─────────────────────────────────────────────────────

interface DualTemplate {
  readonly technical: (issue: VibeIssue) => Suggestion
  readonly vibe: (issue: VibeIssue) => Suggestion
}

const templates: Record<DetectorName, DualTemplate> = {
  'dom-bloat': {
    technical: (issue) => ({
      title: 'DOM Bloat',
      explanation: `${issue.evidence['nodeCount'] ?? 'Too many'} DOM nodes detected. Excess nodes increase memory usage, slow style calculations, and degrade interaction latency.`,
      prompt: `I have a DOM bloat issue — ${issue.evidence['nodeCount'] ?? 'excessive'} nodes on the page.

Audit my component tree and fix:
1. Virtualize any lists with >50 items using @tanstack/react-virtual
2. Replace nested wrapper divs with CSS Grid/Flexbox
3. Use conditional rendering ({condition && <Component />}) instead of display:none
4. Paginate or lazy-load data-heavy sections
5. Check for accidental duplicate renders

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Too many elements on the page',
      explanation: `Your page has ${issue.evidence['nodeCount'] ?? 'way too many'} invisible building blocks. Think of it like a room packed with furniture — the browser has to manage every single piece, making everything sluggish.`,
      prompt: `My page is slow because it has too many elements (${issue.evidence['nodeCount'] ?? 'a lot'} of them). Can you help me reduce them? Look for:
- Long lists that should only show what's visible on screen
- Unnecessary wrapper divs that can be removed
- Sections that could load only when the user scrolls to them
- Hidden elements that should be removed instead of just hidden`,
    }),
  },

  'duplicate-requests': {
    technical: (issue) => ({
      title: 'Duplicate Network Requests',
      explanation: `\`${issue.evidence['url'] ?? 'unknown'}\` fetched ${issue.evidence['count'] ?? 'multiple'} times. Wasted bandwidth, increased TTFB, and potential race conditions.`,
      prompt: `Duplicate network request detected — \`${issue.evidence['url'] ?? 'unknown URL'}\` was fetched ${issue.evidence['count'] ?? 'multiple'} times.

Fix this by:
1. Use React Query or SWR for automatic request deduplication
2. Lift data fetching to a common parent and share via props/context
3. Add proper Cache-Control headers on the API response
4. Debounce any rapid-fire fetches (search, autocomplete)

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Same data fetched multiple times',
      explanation: `Your page is asking the server for the same thing ${issue.evidence['count'] ?? 'several'} times. It's like calling the same restaurant to ask for the menu over and over.`,
      prompt: `My page is fetching the same URL (${issue.evidence['url'] ?? 'a URL'}) multiple times. Can you find where this is happening and make it so it only fetches once? Maybe use a cache or share the data between components that need it.`,
    }),
  },

  'console-spam': {
    technical: (issue) => ({
      title: 'Console Spam',
      explanation: `${issue.evidence['callCount'] ?? 'Excessive'} console messages detected. Each call triggers string serialization and DevTools overhead, blocking the main thread in hot paths.`,
      prompt: `Console spam detected — ${issue.evidence['callCount'] ?? 'many'} messages flooding the console.

Fix:
1. Search codebase for console.log/warn/error and remove debug logs
2. Enable \`no-console\` ESLint rule
3. Replace remaining logs with a level-aware logger
4. Check for libraries with verbose default logging

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Too many console messages',
      explanation: `Your page is printing ${issue.evidence['callCount'] ?? 'tons of'} messages to an invisible log. It's like someone narrating everything they do — it slows things down.`,
      prompt: `My page is spamming the browser console with ${issue.evidence['callCount'] ?? 'too many'} messages. Can you find and remove unnecessary console.log statements? Keep only actual error logging.`,
    }),
  },

  'memory-leak': {
    technical: (issue) => ({
      title: 'Memory Leak',
      explanation: `Heap at ${issue.evidence['currentMB'] ?? 'unknown'}MB with steady growth (${issue.evidence['heapGrowthPct'] ?? 'unknown'}%). Uncollected references accumulating — will cause jank, crashes on long sessions.`,
      prompt: `Memory leak detected — heap at ${issue.evidence['currentMB'] ?? '?'}MB and growing (${issue.evidence['heapGrowthPct'] ?? '?'}% growth).

Audit for:
1. useEffect without cleanup (addEventListener, setInterval, subscriptions)
2. Closures capturing large objects in long-lived callbacks
3. Unbounded state growth (arrays/maps that only grow, never shrink)
4. WebSocket/SSE connections not closed on unmount
5. Detached DOM nodes held by JavaScript references

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Memory keeps growing',
      explanation: `Your page is using more and more memory over time (${issue.evidence['currentMB'] ?? 'a lot of'}MB and climbing). Like leaving all the lights on in every room — eventually something breaks.`,
      prompt: `My page has a memory leak — it keeps using more memory the longer it runs. Can you check for things that get created but never cleaned up? Look for event listeners, timers, or data that keeps growing without being cleared.`,
    }),
  },

  'layout-thrashing': {
    technical: (issue) => ({
      title: 'Layout Thrashing',
      explanation: `${issue.evidence['shiftCount'] ?? 'Multiple'} forced layout recalculations from interleaved read/write DOM operations. Each forced reflow blocks the main thread.`,
      prompt: `Layout thrashing detected — ${issue.evidence['shiftCount'] ?? 'multiple'} forced reflows.

Fix:
1. Batch DOM reads before writes (never interleave)
2. Replace top/left/width/height animations with transform/opacity
3. Use requestAnimationFrame to batch DOM writes
4. Add \`contain: layout\` CSS to isolate recalculation scope
5. Avoid reading offsetHeight/getBoundingClientRect in loops

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (_issue) => ({
      title: 'Page layout keeps recalculating',
      explanation: 'Your page is measuring and moving elements at the same time, over and over. Imagine rearranging furniture while measuring the room — you have to re-measure after every move.',
      prompt: `My page has layout thrashing — it's reading and writing to the page layout in a way that causes constant recalculations. Can you find where this is happening and batch the reads and writes separately? Use CSS transforms instead of changing positions directly.`,
    }),
  },

  'unoptimized-images': {
    technical: (issue) => ({
      title: `Unoptimized: ${getImageName(issue.evidence)}`,
      explanation: `Image \`${getImageName(issue.evidence)}\` missing optimization. ${issue.evidence['issue'] ?? 'Missing dimensions, lazy loading, or modern format.'}`,
      prompt: `Unoptimized image detected: \`${issue.evidence['src'] ?? 'unknown'}\`
Issue: ${issue.evidence['issue'] ?? 'needs optimization'}

Fix:
1. Add explicit width and height attributes to prevent layout shifts
2. Add loading="lazy" for below-the-fold images
3. Use WebP/AVIF format for 30-80% size reduction
4. Use srcset and sizes for responsive images
5. Ensure image dimensions match display size (2x max for retina)

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => {
      const name = getImageName(issue.evidence)
      const details = issue.evidence['issue'] as string | undefined
      return {
        title: `${name} needs optimization`,
        explanation: `"${name}" isn't set up properly.${details ? ` Problem: ${details}.` : ''} It might be causing the page to jump around as it loads, or it's bigger than it needs to be.`,
        prompt: `I have an image "${name}" (${issue.evidence['src'] ?? 'unknown'}) that needs optimization. Can you add proper width and height, enable lazy loading, and convert it to a modern format like WebP?`,
      }
    },
  },

  'large-images': {
    technical: (issue) => ({
      title: 'Large Image',
      explanation: `Image \`${issue.evidence['src'] ?? 'unknown'}\` is ${issue.evidence['transferSizeKB'] ?? '?'}KB — significantly above recommended size for web delivery.`,
      prompt: `Large image detected: \`${issue.evidence['src'] ?? 'unknown'}\` at ${issue.evidence['transferSizeKB'] ?? '?'}KB.

Optimize:
1. Compress with sharp/squoosh or an image CDN
2. Resize to 2x display dimensions max
3. Convert to WebP or AVIF
4. Use responsive srcset for different viewport sizes
5. Consider lazy loading if below the fold

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => {
      const name = getImageName(issue.evidence)
      const sizeKB = issue.evidence['transferSizeKB'] ?? '?'
      const natW = issue.evidence['naturalWidth'] ?? '?'
      const natH = issue.evidence['naturalHeight'] ?? '?'
      const renW = issue.evidence['renderedWidth'] ?? '?'
      const renH = issue.evidence['renderedHeight'] ?? '?'
      return {
        title: `${name} is ${sizeKB}KB`,
        explanation: `"${name}" is ${sizeKB}KB (${natW}×${natH} pixels displayed at ${renW}×${renH}). That's way too heavy — it makes your page load slowly.`,
        prompt: `I have an image "${name}" (${issue.evidence['src'] ?? 'unknown'}) that's ${sizeKB}KB. It's ${natW}×${natH} pixels but displayed at only ${renW}×${renH}. Can you compress it, resize it to what's actually displayed, and convert it to a modern format?`,
      }
    },
  },

  'long-task-attribution': {
    technical: (issue) => ({
      title: 'Long Task',
      explanation: `Task blocked main thread for ${issue.evidence['duration'] ?? '?'}ms. Source: ${issue.evidence['sourceURL'] ?? 'unknown'}. Causes input delay and frame drops.`,
      prompt: `Long task detected — ${issue.evidence['duration'] ?? '?'}ms blocking the main thread.
Source: ${issue.evidence['sourceURL'] ?? 'unknown'}

Fix:
1. Profile with Chrome DevTools Performance tab to identify the slow function
2. Move heavy computation to a Web Worker
3. Break up work with scheduler.yield() or setTimeout chunks
4. Memoize expensive calculations (useMemo/React.memo)
5. Defer non-critical work with requestIdleCallback

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Something is freezing the page',
      explanation: `A piece of code took ${issue.evidence['duration'] ?? 'too long'}ms to run, freezing your page during that time. It's like one person hogging the checkout lane — nothing else can happen until they're done.`,
      prompt: `Something is making my page freeze for ${issue.evidence['duration'] ?? 'a long time'}ms. Can you find what's taking so long and break it into smaller pieces so the page stays responsive?`,
    }),
  },

  'resource-bloat': {
    technical: (issue) => ({
      title: 'Resource Bloat',
      explanation: `Large ${issue.evidence['type'] ?? 'resource'} at ${issue.evidence['transferSizeKB'] ?? '?'}KB. Bloated bundles increase load time and compete for bandwidth.`,
      prompt: `Resource bloat: \`${issue.evidence['url'] ?? 'unknown'}\` is ${issue.evidence['transferSizeKB'] ?? '?'}KB.

Fix:
1. Run bundle analyzer (vite-bundle-visualizer, source-map-explorer)
2. Tree-shake imports — use named imports from lodash-es etc.
3. Code-split routes with React.lazy() + Suspense
4. Remove unused dependencies
5. Ensure gzip/brotli compression on server

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Page is downloading too much code',
      explanation: `Your page loaded a ${issue.evidence['transferSizeKB'] ?? 'huge'}KB file. That's a lot of code — much of it probably unused. It makes your page take longer to start.`,
      prompt: `My page is loading a very large file (${issue.evidence['transferSizeKB'] ?? 'too large'}KB). Can you check if we're importing more than we need, and split the code so we only load what's necessary for each page?`,
    }),
  },

  'web-essentials': {
    technical: (issue) => ({
      title: 'Web Essential Missing',
      explanation: `${issue.evidence['check'] ?? 'A basic HTML requirement'} is missing. These fundamentals affect SEO, accessibility, and browser behavior.`,
      prompt: `Web essential missing: ${issue.evidence['check'] ?? 'unknown'}

Fix the HTML document head:
1. Add <meta charset="UTF-8">
2. Add <meta name="viewport" content="width=device-width, initial-scale=1.0">
3. Add <html lang="en"> (or appropriate language)
4. Add a descriptive <title>
5. Add <link rel="icon" href="/favicon.ico">
6. Add <meta name="description" content="...">

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: 'Basic page setup missing',
      explanation: `Your page is missing some basic setup that every website needs. Without it, search engines can't understand your site properly and it might look weird on phones.`,
      prompt: `My page is missing some basic HTML setup (${issue.evidence['check'] ?? 'some essentials'}). Can you make sure the page has a proper title, viewport settings, language attribute, and favicon?`,
    }),
  },

  'heavy-library': {
    technical: (issue) => ({
      title: `${issue.evidence['library'] ?? 'Heavy Library'} Detected`,
      explanation: `${issue.evidence['library'] ?? 'A heavy library'} (${issue.evidence['bundleSizeKB'] ?? '?'}KB gzip) found. ${(issue.evidence['knownIssues'] as string[] | undefined)?.join('. ') ?? 'Known to cause performance issues.'}`,
      prompt: `Heavy library detected: ${issue.evidence['library'] ?? 'unknown'} (${issue.evidence['packageName'] ?? 'unknown'}, ${issue.evidence['bundleSizeKB'] ?? '?'}KB gzip).

Known performance risks:
${((issue.evidence['knownIssues'] as string[] | undefined) ?? []).map((i) => `- ${i}`).join('\n')}

Audit this library's usage:
1. Check if the library is tree-shaken properly (using named imports)
2. Verify cleanup on component unmount (dispose, kill, destroy methods)
3. Consider if a lighter alternative exists for your use case
4. Ensure animations/effects are paused when not visible
5. Check for duplicate instances or redundant initialization

Evidence: ${JSON.stringify(issue.evidence)}`,
    }),
    vibe: (issue) => ({
      title: `${issue.evidence['library'] ?? 'A heavy library'} is loaded`,
      explanation: `${issue.evidence['vibeDescription'] ?? `Your page includes ${issue.evidence['library'] ?? 'a large library'} which adds ${issue.evidence['bundleSizeKB'] ?? 'a lot of'}KB to your page.`}`,
      prompt: `My page is using ${issue.evidence['library'] ?? 'a heavy library'} which could be causing performance issues. Can you check:
- Are we using this library efficiently?
- Are there lighter alternatives?
- Is everything being cleaned up properly when components are removed?
- Can we load it only when actually needed?`,
    }),
  },
}

// ── Public API ──────────────────────────────────────────────────────────────

export const getSuggestion = (issue: VibeIssue, mode: SuggestionMode = 'technical'): Suggestion => {
  const template = templates[issue.detector]

  if (!template) {
    return {
      title: issue.title,
      explanation: issue.description,
      prompt: `Fix this performance issue: ${issue.title}\n\n${issue.description}\n\nEvidence: ${JSON.stringify(issue.evidence)}`,
    }
  }

  return template[mode](issue)
}

export const getAgentPrompt = (issues: readonly VibeIssue[], mode: SuggestionMode = 'technical'): string => {
  if (issues.length === 0) return ''

  const header = mode === 'technical'
    ? '# Performance Issues Detected by Vibe Check\n\nFix the following performance issues in priority order:\n'
    : '# Performance Problems Found\n\nMy page has some performance problems. Please fix them:\n'

  const issuePrompts = issues.map((issue, i) => {
    const suggestion = getSuggestion(issue, mode)
    return `## ${i + 1}. ${suggestion.title} [${issue.severity.toUpperCase()}]\n\n${suggestion.prompt}`
  })

  return `${header}\n${issuePrompts.join('\n\n---\n\n')}`
}

// ── Proactive prompt templates (for users to copy before issues are found) ──

export interface ProactivePrompt {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly prompt: string
  readonly category: 'scan' | 'optimize' | 'audit' | 'cleanup'
}

export const PROACTIVE_PROMPTS: readonly ProactivePrompt[] = [
  {
    id: 'full-scan',
    title: 'Full Performance Scan',
    description: 'Ask your agent to do a comprehensive performance audit',
    category: 'scan',
    prompt: `Perform a comprehensive performance audit of this project:

1. **Bundle Analysis**: Run the bundle analyzer and identify the largest dependencies. Are there tree-shaking opportunities? Are any libraries imported in full when only parts are needed?

2. **Render Performance**: Look for unnecessary re-renders, missing React.memo/useMemo, expensive computations in render paths, and layout thrashing.

3. **Network**: Check for duplicate API calls, missing caching, uncompressed assets, and render-blocking resources.

4. **Images**: Find unoptimized images (missing dimensions, no lazy loading, wrong format, oversized for display).

5. **Memory**: Look for event listener leaks, growing state, uncleaned subscriptions, and detached DOM nodes.

6. **Core Web Vitals**: Identify what's hurting LCP, INP, and CLS.

For each issue found, explain the impact and provide a specific fix with code.`,
  },
  {
    id: 'animation-audit',
    title: 'Animation Performance Check',
    description: 'Audit all animations for performance issues',
    category: 'audit',
    prompt: `Audit all animations in this project for performance:

1. Find all CSS animations, transitions, and JS-driven animations
2. Check if any animate layout-triggering properties (width, height, top, left, margin, padding) — these should use transform/opacity instead
3. Look for animations that run when not visible (waste CPU)
4. Check for proper cleanup in React components (kill/dispose on unmount)
5. Verify animations respect prefers-reduced-motion
6. Ensure animation libraries (Framer Motion, GSAP, etc.) are tree-shaken

Flag anything running at <30fps or causing layout recalculations.`,
  },
  {
    id: 'bundle-diet',
    title: 'Put Your Bundle on a Diet',
    description: 'Find and remove unnecessary weight from your JavaScript',
    category: 'optimize',
    prompt: `My JavaScript bundle is too large. Help me slim it down:

1. Find all imported libraries and check their bundle sizes
2. Identify libraries that can be replaced with native APIs (moment→Intl, lodash→native, etc.)
3. Check for barrel imports that defeat tree-shaking
4. Find code that should be lazy-loaded (routes, modals, heavy components)
5. Look for duplicate dependencies (different versions of the same library)
6. Check if dev-only code is leaking into production builds

For each issue, show me the specific fix and estimated size savings.`,
  },
  {
    id: 'cleanup-leaks',
    title: 'Find & Fix Memory Leaks',
    description: 'Hunt down everything that leaks memory',
    category: 'cleanup',
    prompt: `Search this project for memory leaks:

1. Find every useEffect and verify it has proper cleanup (removeEventListener, clearInterval, clearTimeout, unsubscribe)
2. Look for global state that grows without bounds (arrays, maps, sets that only add, never remove)
3. Check for WebSocket/SSE connections that aren't closed on unmount
4. Find closures that capture large objects in long-lived callbacks
5. Look for DOM references stored in variables that outlive their elements
6. Check for animation frame loops that continue when components unmount

Fix every leak you find and explain what was wrong.`,
  },
  {
    id: 'image-optimize',
    title: 'Optimize All Images',
    description: 'Make every image on your page load fast',
    category: 'optimize',
    prompt: `Optimize every image in this project:

1. Find all <img> tags and background images
2. Add width and height attributes to prevent layout shifts
3. Add loading="lazy" to below-the-fold images
4. Set up responsive images with srcset and sizes
5. Convert to WebP format where possible
6. Ensure images are sized appropriately (not serving 4000px images in 400px containers)

Use Next.js Image component or build a reusable OptimizedImage component if the framework supports it.`,
  },
  {
    id: 'console-cleanup',
    title: 'Clean Up Console Noise',
    description: 'Remove debug logs and add proper error handling',
    category: 'cleanup',
    prompt: `Clean up all console usage in this project:

1. Remove all console.log statements used for debugging
2. Replace meaningful console.error calls with proper error handling/reporting
3. Add an ESLint rule to prevent future console.log commits
4. Set up a simple logger utility that only logs in development
5. Check for third-party libraries spamming the console and configure their log level

Keep console.error for actual errors that need attention.`,
  },
]
