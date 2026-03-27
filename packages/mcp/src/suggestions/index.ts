import type { DetectorName, VibeIssue } from '../types.js'

const formatEvidence = (evidence: Record<string, unknown>): string =>
  Object.entries(evidence)
    .map(([key, value]) => `- **${key}**: ${JSON.stringify(value)}`)
    .join('\n')

const suggestionTemplates: Record<DetectorName, (issue: VibeIssue) => string> = {
  'dom-bloat': (issue) => {
    const nodeCount = issue.evidence['nodeCount'] ?? 'unknown'
    return `## DOM Bloat Detected

**What:** The page has ${nodeCount} DOM nodes, which exceeds healthy thresholds.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Rendering entire lists without virtualization
- Generating deeply nested wrapper \`<div>\` elements
- Not cleaning up dynamically added elements
- Duplicating DOM structures instead of reusing components

### Fix Steps
1. **Audit the component tree** — identify which component renders the most nodes
2. **Virtualize long lists** — use \`react-window\` or \`@tanstack/react-virtual\` for lists > 50 items
3. **Flatten nesting** — replace nested wrapper divs with CSS Grid/Flexbox
4. **Conditionally render** — use \`{condition && <Component />}\` instead of \`display: none\`
5. **Paginate data** — load items in chunks rather than rendering all at once

### Example Fix
\`\`\`tsx
// Before: renders all 10,000 items
<ul>
  {items.map(item => <li key={item.id}>{item.name}</li>)}
</ul>

// After: virtualized list
import { useVirtualizer } from '@tanstack/react-virtual'

const virtualizer = useVirtualizer({
  count: items.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 35,
})
\`\`\``
  },

  'duplicate-requests': (issue) => {
    const url = issue.evidence['url'] ?? 'unknown URL'
    const count = issue.evidence['count'] ?? 'multiple'
    return `## Duplicate Network Requests Detected

**What:** The same resource at \`${url}\` was fetched ${count} times.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Multiple components independently fetching the same data
- Missing request deduplication in data fetching layer
- useEffect dependencies causing re-fetches on every render
- Not using a query cache (React Query, SWR)

### Fix Steps
1. **Identify the duplicate** — check Network tab for repeated URLs
2. **Centralize data fetching** — use React Query or SWR for automatic deduplication
3. **Lift data up** — fetch once in a parent and pass via props or context
4. **Add caching headers** — ensure API responses have proper Cache-Control
5. **Debounce rapid calls** — for search/autocomplete, debounce input

### Example Fix
\`\`\`tsx
// Before: each component fetches independently
const ComponentA = () => {
  const [data, setData] = useState(null)
  useEffect(() => { fetch('/api/users').then(r => r.json()).then(setData) }, [])
}

// After: shared query with deduplication
import { useQuery } from '@tanstack/react-query'

const useUsers = () => useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(r => r.json()),
  staleTime: 30_000,
})
\`\`\``
  },

  'console-spam': (issue) => {
    const count = issue.evidence['count'] ?? 'excessive'
    const sample = issue.evidence['sample'] ?? ''
    return `## Console Spam Detected

**What:** ${count} console messages detected, degrading DevTools performance and obscuring real errors.

**Evidence:**
${formatEvidence(issue.evidence)}
${sample ? `\n**Sample output:** \`${sample}\`` : ''}

### Common AI-Coding Causes
- AI-generated debug \`console.log\` statements left in production code
- Logging inside hot loops or frequent event handlers (scroll, mousemove)
- Libraries with verbose default logging
- Error boundaries logging every re-render

### Fix Steps
1. **Search codebase** — find all \`console.log\`, \`console.warn\`, \`console.error\` calls
2. **Remove debug logs** — delete any logs added during development
3. **Use a logger** — replace console calls with a logger that respects log levels
4. **Add lint rule** — enable \`no-console\` ESLint rule
5. **Check dependencies** — some libraries log verbosely; configure their log level

### Example Fix
\`\`\`typescript
// Before: console spam in event handler
window.addEventListener('scroll', () => {
  console.log('scroll position:', window.scrollY) // fires 60x/sec
})

// After: remove or use debug-only logging
const logger = {
  debug: import.meta.env.DEV ? console.log : () => {},
  error: console.error,
}
\`\`\``
  },

  'memory-leak': (issue) => {
    const heapMB = issue.evidence['jsHeapSizeMB'] ?? 'unknown'
    const growth = issue.evidence['growthRate'] ?? 'unknown'
    return `## Memory Leak Detected

**What:** JavaScript heap is at ${heapMB}MB and growing. Growth rate: ${growth}.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Event listeners added in useEffect without cleanup
- setInterval/setTimeout without clearInterval/clearTimeout
- Closures capturing large objects in long-lived callbacks
- Accumulating state without bounds (growing arrays/maps)
- Subscriptions (WebSocket, EventSource) not unsubscribed on unmount

### Fix Steps
1. **Profile memory** — use Chrome DevTools Memory tab, take heap snapshots
2. **Check useEffect cleanups** — every addEventListener needs removeEventListener
3. **Check intervals/timeouts** — ensure clearInterval in cleanup functions
4. **Bound collections** — cap array/map sizes, evict old entries
5. **Check subscriptions** — WebSocket, SSE, and pub/sub must unsubscribe

### Example Fix
\`\`\`tsx
// Before: leaking event listener
useEffect(() => {
  window.addEventListener('resize', handleResize)
  // Missing cleanup!
}, [])

// After: proper cleanup
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => window.removeEventListener('resize', handleResize)
}, [])

// Before: unbounded state growth
const [logs, setLogs] = useState<string[]>([])
onMessage((msg) => setLogs(prev => [...prev, msg])) // grows forever

// After: bounded ring buffer
onMessage((msg) => setLogs(prev => [...prev.slice(-99), msg]))
\`\`\``
  },

  'layout-thrashing': (issue) => {
    const count = issue.evidence['count'] ?? 'multiple'
    const properties = issue.evidence['properties'] ?? 'layout properties'
    return `## Layout Thrashing Detected

**What:** ${count} forced layout recalculations detected from interleaved read/write DOM operations.

**Evidence:**
${formatEvidence(issue.evidence)}
${properties ? `\n**Thrashed properties:** ${properties}` : ''}

### Common AI-Coding Causes
- Reading offsetHeight/getBoundingClientRect then immediately writing styles
- Animating layout properties (width, height, top, left) in JavaScript
- Measuring elements inside a loop that also modifies DOM
- Using element.style directly instead of CSS classes or transforms

### Fix Steps
1. **Batch reads, then writes** — read all measurements first, then apply all changes
2. **Use transforms** — replace top/left/width/height animations with transform/opacity
3. **Use requestAnimationFrame** — batch DOM writes into a single rAF callback
4. **Use CSS containment** — add \`contain: layout\` to isolate layout recalculations
5. **Avoid layout-triggering properties** — offsetHeight, clientWidth, getBoundingClientRect force layout

### Example Fix
\`\`\`typescript
// Before: layout thrashing in loop
elements.forEach(el => {
  const height = el.offsetHeight    // FORCED LAYOUT
  el.style.height = height * 2 + 'px' // WRITE -> invalidates layout
})

// After: batch reads then writes
const heights = elements.map(el => el.offsetHeight) // all reads
elements.forEach((el, i) => {
  el.style.height = heights[i] * 2 + 'px' // all writes
})

// Even better: use CSS transforms
el.style.transform = \`scaleY(2)\` // no layout recalc
\`\`\``
  },

  'unoptimized-images': (issue) => {
    const src = issue.evidence['src'] ?? 'unknown image'
    const sizeKB = issue.evidence['sizeKB'] ?? 'large'
    const naturalWidth = issue.evidence['naturalWidth'] ?? 'unknown'
    const displayWidth = issue.evidence['displayWidth'] ?? 'unknown'
    return `## Unoptimized Image Detected

**What:** Image \`${src}\` is ${sizeKB}KB. Natural size: ${naturalWidth}px, displayed at: ${displayWidth}px.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Using original high-res images without resizing
- Missing width/height attributes causing layout shifts
- Not using modern formats (WebP/AVIF)
- Loading all images eagerly instead of lazy-loading
- Serving same image size to all viewport widths

### Fix Steps
1. **Resize to display size** — serve images at 2x display size maximum (for retina)
2. **Use modern formats** — convert to WebP (90%+ browser support) or AVIF
3. **Add dimensions** — always set \`width\` and \`height\` attributes to prevent CLS
4. **Lazy load** — add \`loading="lazy"\` to below-the-fold images
5. **Use responsive images** — \`srcset\` and \`sizes\` for different viewports
6. **Use a CDN** — image CDNs (Cloudflare Images, imgix) auto-optimize

### Example Fix
\`\`\`html
<!-- Before: unoptimized -->
<img src="/photo.png" />

<!-- After: optimized with responsive loading -->
<img
  src="/photo.webp"
  srcset="/photo-400.webp 400w, /photo-800.webp 800w, /photo-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
  alt="Description"
/>
\`\`\``
  },

  'large-images': (issue) => {
    const src = issue.evidence['src'] ?? 'unknown image'
    const sizeKB = issue.evidence['sizeKB'] ?? 'large'
    return `## Large Image Detected

**What:** Image \`${src}\` is ${sizeKB}KB, significantly larger than recommended for web delivery.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Using raw camera photos or design exports without compression
- Embedding high-resolution images for small display areas
- Not converting to modern formats (WebP/AVIF)
- Missing responsive image handling (serving desktop images on mobile)

### Fix Steps
1. **Compress the image** — use tools like \`sharp\`, \`squoosh\`, or image CDN auto-optimization
2. **Resize to display dimensions** — serve at 2x display size max (for retina)
3. **Convert format** — use WebP (90%+ browser support) or AVIF for further savings
4. **Lazy load** — add \`loading="lazy"\` for below-the-fold images
5. **Use responsive images** — \`srcset\` and \`sizes\` for viewport-appropriate delivery

### Example Fix
\`\`\`html
<!-- Before: 2MB raw image -->
<img src="/hero.png" />

<!-- After: optimized responsive image -->
<img
  src="/hero.webp"
  srcset="/hero-400.webp 400w, /hero-800.webp 800w"
  sizes="(max-width: 600px) 400px, 800px"
  width="800" height="450"
  loading="lazy" decoding="async"
  alt="Hero banner"
/>
\`\`\``
  },

  'long-task-attribution': (issue) => {
    const duration = issue.evidence['duration'] ?? 'unknown'
    const source = issue.evidence['source'] ?? 'unknown source'
    return `## Long Task Detected

**What:** A task took ${duration}ms to execute, blocking the main thread. Source: ${source}.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Heavy computation in render cycle (sorting, filtering large arrays)
- Synchronous JSON parsing of large payloads
- Complex regular expressions on long strings
- Unoptimized third-party scripts blocking main thread
- Large component trees re-rendering unnecessarily

### Fix Steps
1. **Profile the task** — use Chrome DevTools Performance tab to find the slow function
2. **Move to Web Worker** — offload heavy computation to a worker thread
3. **Chunk the work** — use \`scheduler.yield()\` or \`setTimeout\` to break up long tasks
4. **Memoize** — use \`useMemo\`/\`React.memo\` to avoid redundant computation
5. **Virtualize** — don't render what's not visible
6. **Defer non-critical work** — use \`requestIdleCallback\` for low-priority tasks

### Example Fix
\`\`\`typescript
// Before: blocks main thread for 200ms
const sorted = hugeArray.sort((a, b) => expensiveCompare(a, b))

// After: yield to main thread between chunks
const sortInChunks = async (arr: Item[]) => {
  const chunks = chunkArray(arr, 1000)
  const results: Item[] = []
  for (const chunk of chunks) {
    results.push(...chunk.sort((a, b) => expensiveCompare(a, b)))
    await scheduler.yield() // let browser handle events
  }
  return mergeSort(results)
}

// Or: move to Web Worker
const worker = new Worker(new URL('./sort-worker.ts', import.meta.url))
worker.postMessage({ data: hugeArray })
worker.onmessage = (e) => setSorted(e.data)
\`\`\``
  },

  'web-essentials': (issue) => {
    const check = issue.evidence['check'] ?? 'unknown check'
    return `## Web Essential Missing

**What:** ${check}

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Missing viewport meta tag in generated HTML
- No \`<html lang>\` attribute for accessibility
- Missing \`<title>\` or duplicate title tags
- Not setting charset or using non-UTF-8 encoding
- Missing favicon causing repeated 404s

### Fix Steps
1. **Check document head** — ensure viewport, charset, lang, and title are set
2. **Add favicon** — even a simple one prevents 404 noise
3. **Validate HTML** — use W3C validator to catch structural issues
4. **Check accessibility basics** — lang attribute, heading hierarchy, alt text

### Example Fix
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="icon" href="/favicon.ico" />
</head>
\`\`\``
  },

  'resource-bloat': (issue) => {
    const totalKB = issue.evidence['totalTransferKB'] ?? 'unknown'
    const resourceCount = issue.evidence['resourceCount'] ?? 'unknown'
    const jsKB = issue.evidence['jsTransferKB'] ?? 'unknown'
    return `## Resource Bloat Detected

**What:** Page loaded ${totalKB}KB across ${resourceCount} resources. JavaScript: ${jsKB}KB.

**Evidence:**
${formatEvidence(issue.evidence)}

### Common AI-Coding Causes
- Importing entire libraries when only a few functions are needed
- Not code-splitting routes (entire app in one bundle)
- Including dev-only dependencies in production build
- Duplicate dependencies (different versions of same library)
- Large inline assets (base64 images, embedded fonts)

### Fix Steps
1. **Analyze bundle** — run \`npx vite-bundle-visualizer\` or \`source-map-explorer\`
2. **Tree-shake imports** — use named imports: \`import { debounce } from 'lodash-es'\`
3. **Code-split routes** — use \`React.lazy()\` and \`Suspense\` for route-level splitting
4. **Remove unused deps** — audit \`package.json\`, remove what you don't use
5. **Compress assets** — ensure gzip/brotli compression on server
6. **Defer non-critical JS** — load analytics, chat widgets after page load

### Example Fix
\`\`\`typescript
// Before: imports entire lodash (70KB+)
import _ from 'lodash'
_.debounce(fn, 300)

// After: tree-shakeable import (4KB)
import { debounce } from 'lodash-es'
debounce(fn, 300)

// Before: eager route loading
import { Dashboard } from './pages/Dashboard'

// After: lazy route loading
const Dashboard = lazy(() => import('./pages/Dashboard'))
\`\`\``
  },
}

export const getSuggestion = (issue: VibeIssue): string => {
  const template = suggestionTemplates[issue.detector]

  if (!template) {
    return 'No suggestion available'
  }

  return template(issue)
}
