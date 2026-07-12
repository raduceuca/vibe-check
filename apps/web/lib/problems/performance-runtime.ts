import type { Problem } from './types'

// ── Runtime performance problems ─────────────────────────────────────────────
// The main-thread / memory / layout detectors. Source: packages/core/src/
// detectors/{domBloat,memoryLeak,layoutThrashing,longTaskAttribution,
// consoleSpam,duplicateRequests}.ts and the fix templates in suggestions/index.ts.

export const performanceRuntimeProblems: readonly Problem[] = [
  {
    slug: 'excessive-dom-size',
    category: 'performance',
    detector: 'dom-bloat',
    severity: 'error',
    title: 'Fix an excessive DOM size (too many nodes)',
    metaDescription:
      'A huge DOM slows style, layout and memory on every frame. Virtualize long lists and flatten wrappers to get node count back under control.',
    h1: 'Excessive DOM size',
    pain: 'Every DOM node the browser has to style, lay out, and keep in memory costs time on each frame, so a page with thousands of nodes feels sluggish to scroll and slow to interact with. AI agents produce this constantly: they map over data without virtualization, wrap everything in defensive `<div>`s, and render hidden content with `display:none` instead of not rendering it. The result passes review because it looks right — it just quietly janks.',
    symptoms: [
      'Scrolling stutters and interactions feel laggy on lower-end devices',
      'React/Vue DevTools shows thousands of elements under one list',
      'Style recalculation and layout dominate the Performance panel flame chart',
      'Memory climbs with the size of the rendered list',
    ],
    detection: {
      detector: 'dom-bloat',
      issueString: 'DOM has 1500 nodes',
      threshold: '≥ 800 nodes (warning), ≥ 1,500 nodes (error) — sampled every 5s',
    },
    rootCauses: [
      'Rendering a long list in full instead of windowing/virtualizing it',
      'Deeply nested wrapper `<div>`s that add nodes without structure',
      'Hidden content rendered with `display:none` instead of not being mounted',
      'Duplicate renders of the same subtree',
    ],
    fix: {
      summary:
        'Only render what is on screen. Virtualize long lists so the DOM holds a small window of rows, flatten unnecessary wrapper elements using CSS grid/flex, and conditionally mount content instead of hiding it. As a cheap first win, add CSS `content-visibility:auto` to offscreen sections so the browser skips their layout.',
      steps: [
        'Find the largest list or repeated subtree (VibeCheck reports the heaviest selector)',
        'Virtualize it so only visible rows are in the DOM',
        'Remove redundant wrapper elements and replace `display:none` with conditional rendering',
      ],
      code: [
        {
          lang: 'css',
          caption: 'Cheap win: let the browser skip offscreen layout',
          code: `.section {
  content-visibility: auto;
  contain-intrinsic-size: 0 500px; /* reserve space to avoid scroll jump */
}`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Use a windowing library so a 10,000-row list keeps ~20 rows in the DOM. `@tanstack/react-virtual` is headless and works with any markup.',
        docsUrl: 'https://tanstack.com/virtual/latest',
        code: [
          {
            lang: 'tsx',
            code: `import { useVirtualizer } from '@tanstack/react-virtual'

function Rows({ items }: { items: Item[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rows = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
  })
  return (
    <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
      <div style={{ height: rows.getTotalSize(), position: 'relative' }}>
        {rows.getVirtualItems().map((v) => (
          <div key={v.key} style={{ position: 'absolute', top: v.start, height: v.size }}>
            {items[v.index].label}
          </div>
        ))}
      </div>
    </div>
  )
}`,
          },
        ],
      },
      nextjs: {
        note: 'Same virtualization applies, but also move list rendering into Server Components and stream it — the client bundle and hydration cost drop, and you can paginate at the data layer instead of shipping every row.',
        code: [
          {
            lang: 'tsx',
            caption: 'Paginate on the server instead of rendering all rows',
            code: `export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page = '1' } = await searchParams
  const rows = await db.items.findMany({ take: 50, skip: (Number(page) - 1) * 50 })
  return <List rows={rows} />
}`,
          },
        ],
      },
      vue: {
        note: 'Use `@tanstack/vue-virtual` (or `vue-virtual-scroller`) to window long lists.',
        docsUrl: 'https://tanstack.com/virtual/latest/docs/framework/vue/vue-virtual',
        code: [
          {
            lang: 'vue',
            code: `<script setup lang="ts">
import { useVirtualizer } from '@tanstack/vue-virtual'
import { ref } from 'vue'
const parentRef = ref<HTMLElement | null>(null)
const rowVirtualizer = useVirtualizer({
  count: props.items.length,
  getScrollElement: () => parentRef.value,
  estimateSize: () => 40,
})
</script>`,
          },
        ],
      },
      svelte: {
        note: 'Use `@tanstack/svelte-virtual`, or a Svelte-native virtual list, to keep only visible rows mounted.',
        code: [
          {
            lang: 'svelte',
            code: `<script lang="ts">
  import { createVirtualizer } from '@tanstack/svelte-virtual'
  let parentRef: HTMLElement
  const virtualizer = createVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef,
    estimateSize: () => 40,
  })
</script>`,
          },
        ],
      },
      vanilla: {
        note: 'Without a framework, reach for CSS `content-visibility` first, then hand-roll windowing: render a fixed pool of rows and reposition them on scroll.',
        code: [
          {
            lang: 'css',
            code: `.list-item { content-visibility: auto; contain-intrinsic-size: 0 40px; }`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'How many DOM nodes is too many?',
        a: 'Lighthouse warns past ~800 and errors past ~1,500 nodes in one document — the same thresholds VibeCheck uses. Under ~800 is comfortable; the exact number matters less than avoiding unbounded lists.',
      },
      {
        q: 'Does hiding elements with `display:none` reduce DOM size?',
        a: 'No. Hidden elements are still in the DOM and still cost memory and (for some operations) layout. Conditionally render them instead so they aren’t created until needed.',
      },
      {
        q: 'Will `content-visibility` fix it on its own?',
        a: 'It skips rendering work for offscreen sections, which is a big, cheap win — but the nodes still exist. For truly large lists (thousands of rows) you still need virtualization.',
      },
    ],
    related: ['cumulative-layout-shift', 'long-tasks', 'memory-leak', 'large-javascript-bundles'],
  },

  {
    slug: 'memory-leak',
    category: 'performance',
    detector: 'memory-leak',
    severity: 'error',
    title: 'Fix a JavaScript memory leak',
    metaDescription:
      'A leaking heap grows until the tab janks or crashes. Find the listeners, timers and subscriptions that are never cleaned up and release them.',
    h1: 'JavaScript memory leak',
    pain: 'A memory leak means the heap grows every time you navigate or interact and never comes back down, until long sessions jank, stutter, and eventually crash the tab. It is one of the hardest bugs to catch in review because it only shows up over time — the happy-path click looks fine. AI-generated effects and subscriptions are a frequent source: the setup is written, the cleanup is forgotten.',
    symptoms: [
      'The page gets slower the longer it stays open',
      'Heap usage climbs across route changes and never recovers after GC',
      'Eventually a tab crash or "Aw, Snap" on long sessions',
      'DevTools Memory timeline shows a rising staircase of retained objects',
    ],
    detection: {
      detector: 'memory-leak',
      issueString: 'Potential memory leak (27% growth)',
      threshold: '> 10% heap growth over 30s without GC recovery (warning), > 25% (error)',
    },
    rootCauses: [
      '`addEventListener` / `setInterval` / `setTimeout` without a matching cleanup',
      'Subscriptions (WebSocket, SSE, store, RxJS) never unsubscribed on unmount',
      'State that only grows — arrays/maps/caches that append and never evict',
      'Detached DOM nodes still referenced by a closure or long-lived variable',
    ],
    fix: {
      summary:
        'For every side effect that acquires a resource, register a teardown that releases it when the component unmounts or the effect re-runs. Remove event listeners, clear timers, close connections, and unsubscribe. Bound any long-lived cache so it evicts instead of growing forever.',
      steps: [
        'Audit every effect/lifecycle hook that adds a listener, timer, or subscription',
        'Return or register a cleanup that removes exactly what was added',
        'Bound caches and growing arrays with an eviction policy (e.g. LRU or max size)',
      ],
      code: [
        {
          lang: 'js',
          caption: 'The shape of every fix: acquire → release',
          code: `const id = setInterval(tick, 1000)
const onResize = () => layout()
window.addEventListener('resize', onResize)

// teardown — runs on unmount / effect re-run
clearInterval(id)
window.removeEventListener('resize', onResize)`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Return a cleanup function from `useEffect`. It runs on unmount and before every re-run, so the listener/timer/subscription is always released.',
        docsUrl: 'https://react.dev/reference/react/useEffect#connecting-to-an-external-system',
        code: [
          {
            lang: 'tsx',
            code: `useEffect(() => {
  const id = setInterval(tick, 1000)
  const onResize = () => setW(window.innerWidth)
  window.addEventListener('resize', onResize)
  const sub = source.subscribe(setData)
  return () => {
    clearInterval(id)
    window.removeEventListener('resize', onResize)
    sub.unsubscribe()
  }
}, [])`,
          },
        ],
      },
      nextjs: {
        note: 'Same `useEffect` cleanup rules — but leaks in Next are most visible across client-side route changes, where a component unmounts without releasing a global listener. Also guard against effects running twice under React Strict Mode by making cleanup idempotent.',
        code: [
          {
            lang: 'tsx',
            code: `'use client'
useEffect(() => {
  const ws = new WebSocket(url)
  ws.onmessage = onMessage
  return () => ws.close() // fires on navigation away
}, [url])`,
          },
        ],
      },
      vue: {
        note: 'Register teardown in `onUnmounted` (Composition API) or `beforeUnmount` (Options API). `onScopeDispose` works inside composables.',
        docsUrl: 'https://vuejs.org/api/composition-api-lifecycle.html#onunmounted',
        code: [
          {
            lang: 'vue',
            code: `<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
let id: number
const onResize = () => (w.value = window.innerWidth)
onMounted(() => {
  id = window.setInterval(tick, 1000)
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  clearInterval(id)
  window.removeEventListener('resize', onResize)
})
</script>`,
          },
        ],
      },
      svelte: {
        note: 'In Svelte 5, return a cleanup from `$effect`; in Svelte 4 use `onDestroy`. Either releases the resource when the component is torn down.',
        docsUrl: 'https://svelte.dev/docs/svelte/lifecycle-hooks',
        code: [
          {
            lang: 'svelte',
            code: `<script lang="ts">
  $effect(() => {
    const id = setInterval(tick, 1000)
    const onResize = () => (w = window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => {
      clearInterval(id)
      window.removeEventListener('resize', onResize)
    }
  })
</script>`,
          },
        ],
      },
      vanilla: {
        note: 'Keep a reference to every listener/timer you add and release them when the view is destroyed. `AbortController` makes multi-listener cleanup a one-liner.',
        code: [
          {
            lang: 'js',
            code: `const ac = new AbortController()
window.addEventListener('resize', onResize, { signal: ac.signal })
document.addEventListener('scroll', onScroll, { signal: ac.signal })
// teardown removes both at once:
ac.abort()`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'How do I confirm it is really a leak and not normal growth?',
        a: 'Take heap snapshots in DevTools Memory before and after repeating an action (e.g. navigate away and back a few times). If retained size keeps climbing and never drops after GC, it’s a leak. VibeCheck watches for exactly this: sustained growth with no recovery.',
      },
      {
        q: 'React Strict Mode runs my effect twice — is that a leak?',
        a: 'No, that is intentional in development to surface missing cleanup. If your cleanup is correct and idempotent, the double-invoke is harmless and doesn’t happen in production.',
      },
      {
        q: 'What are detached DOM nodes?',
        a: 'Nodes removed from the document but still referenced by JavaScript (a closure, a cached array, an event handler). They can’t be garbage-collected. Drop the reference when you remove the node.',
      },
    ],
    related: ['excessive-dom-size', 'console-log-spam', 'heavy-dependencies', 'long-tasks'],
  },

  {
    slug: 'cumulative-layout-shift',
    category: 'performance',
    detector: 'layout-thrashing',
    severity: 'warning',
    title: 'Fix cumulative layout shift (CLS)',
    metaDescription:
      'Content that jumps as the page loads fails Core Web Vitals and mis-taps users. Reserve space for images, ads and late content to stop the shift.',
    h1: 'Cumulative layout shift (CLS)',
    pain: 'Layout shift is when content jumps after it has already rendered — an image loads and pushes the text down, a banner injects itself above the fold, a web font swaps and reflows everything. It is a Core Web Vitals metric Google ranks on, and it makes users tap the wrong thing. AI-built pages shift constantly because generated markup omits `width`/`height` on images and drops late content in without reserving space.',
    symptoms: [
      'Text and buttons jump down as images or ads load in',
      'You tap one thing and hit another because it moved',
      'A visible reflow when the web font swaps in',
      'PageSpeed Insights reports a poor CLS score (> 0.1)',
    ],
    detection: {
      detector: 'layout-thrashing',
      issueString: 'Layout shift cluster detected (3 shifts)',
      threshold: '≥ 3 layout shifts within a 500ms window, with no recent user input',
    },
    rootCauses: [
      'Images and videos without `width`/`height` (or an `aspect-ratio` box) reserving space',
      'Content injected above existing content (banners, cookie bars, ads) after load',
      'Web fonts swapping and reflowing text (FOUT) without a matched fallback',
      'Dynamically sized containers that resize once data arrives',
    ],
    fix: {
      summary:
        'Reserve the final space before the content arrives. Give every image and embed explicit dimensions or a CSS `aspect-ratio` box, insert late content into a pre-sized container (never above existing content), and size fallback fonts to match the web font so the swap doesn’t reflow.',
      steps: [
        'Add `width` and `height` (or `aspect-ratio`) to every image, video, and iframe',
        'Reserve a fixed-size slot for anything injected after load (ads, banners, embeds)',
        'Use `font-display: optional` or a size-adjusted fallback to avoid font-swap reflow',
      ],
      code: [
        {
          lang: 'css',
          caption: 'Reserve space with aspect-ratio',
          code: `.media {
  aspect-ratio: 16 / 9;
  width: 100%;
}
/* size the fallback to the web font so the swap doesn't reflow */
@font-face {
  font-family: 'Inter Fallback';
  src: local('Arial');
  size-adjust: 107%;
}`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: '`next/image` reserves space from the `width`/`height` (or fill + a sized parent) automatically, and `next/font` eliminates font-swap shift by self-hosting with a size-adjusted fallback. Using both removes the two most common CLS sources.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/components/image',
        code: [
          {
            lang: 'tsx',
            code: `import Image from 'next/image'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] }) // no layout shift on swap

<Image src="/hero.jpg" width={1200} height={630} alt="Hero" />`,
          },
        ],
      },
      react: {
        note: 'Always pass `width` and `height` to `<img>` so the browser can reserve the box before the file loads, even when CSS scales it responsively.',
        code: [
          {
            lang: 'tsx',
            code: `<img
  src="/hero.jpg"
  width={1200}
  height={630}
  alt="Hero"
  style={{ width: '100%', height: 'auto' }}
/>`,
          },
        ],
      },
      vanilla: {
        note: 'Set the `width` and `height` attributes on media, and wrap embeds in an `aspect-ratio` box. Never `document.body.prepend()` content above what the user is already reading.',
        code: [
          {
            lang: 'html',
            code: `<img src="/hero.jpg" width="1200" height="630" alt="Hero" style="width:100%;height:auto" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What CLS score do I need?',
        a: 'Google considers CLS good at 0.1 or below, and poor above 0.25, for 75% of page loads. It is one of the three Core Web Vitals used in ranking.',
      },
      {
        q: 'Why does the layout-thrashing detector flag this?',
        a: 'VibeCheck observes the browser’s layout-shift entries. When three or more fire within 500ms without user input, it flags a cluster — that burst is exactly what a jumpy load feels like.',
      },
      {
        q: 'My image is responsive — do I still set `width` and `height`?',
        a: 'Yes. Set the intrinsic `width`/`height` attributes so the browser knows the aspect ratio, then use CSS (`width:100%`; `height:auto`) to scale it. That gives you responsiveness with zero shift.',
      },
    ],
    related: ['unoptimized-images', 'large-image-files', 'excessive-dom-size', 'long-tasks'],
  },

  {
    slug: 'long-tasks',
    category: 'performance',
    detector: 'long-task-attribution',
    severity: 'warning',
    title: 'Fix long tasks blocking the main thread',
    metaDescription:
      'Long tasks freeze the page and wreck INP. Break up heavy work, defer it, or move it to a worker so the main thread stays responsive to input.',
    h1: 'Long tasks blocking the main thread',
    pain: 'The browser runs your JavaScript on the same single thread it uses to respond to clicks and paint frames, so any task that runs too long freezes everything — the page can’t respond to input while it works. This is what wrecks INP (Interaction to Next Paint) and makes a page feel janky right after load. AI code tends to do expensive work synchronously in render or on mount instead of chunking or deferring it.',
    symptoms: [
      'The page is unresponsive for a beat after it loads or on first interaction',
      'Clicks and typing feel delayed (poor INP)',
      'The Performance panel shows long yellow "Task" blocks with a red corner',
      'A single script dominates the main-thread flame chart',
    ],
    detection: {
      detector: 'long-task-attribution',
      issueString: 'Script causing long frames: bundle.js',
      threshold: 'A single script attributed to more than 3 long animation frames (LoAF)',
    },
    rootCauses: [
      'Expensive computation (parsing, sorting, formatting) run synchronously on the main thread',
      'Large hydration or initialization work on mount',
      'A heavy third-party script executing during load',
      'Rendering or diffing a very large component tree in one pass',
    ],
    fix: {
      summary:
        'Keep individual tasks short. Break long work into chunks that yield to the browser between them, move pure computation into a Web Worker, defer non-critical work until the page is idle, and memoize expensive results so they don’t recompute on every render.',
      steps: [
        'Profile to find the script behind the long task (VibeCheck names it)',
        'Move heavy pure computation into a Web Worker, or chunk it with yielding',
        'Defer non-critical work with `requestIdleCallback` / `scheduler.yield`',
      ],
      code: [
        {
          lang: 'js',
          caption: 'Yield to the browser between chunks so input can be handled',
          code: `async function processInChunks(items) {
  for (let i = 0; i < items.length; i++) {
    doWork(items[i])
    if (i % 50 === 0) {
      // let the browser paint and handle input
      await (window.scheduler?.yield?.() ?? new Promise((r) => setTimeout(r)))
    }
  }
}`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Wrap non-urgent state updates in `startTransition` so React can interrupt them for input, and memoize expensive derived values so they don’t recompute every render. Code-split heavy components with `React.lazy`.',
        docsUrl: 'https://react.dev/reference/react/startTransition',
        code: [
          {
            lang: 'tsx',
            code: `import { startTransition, useMemo, lazy } from 'react'

const Heavy = lazy(() => import('./Heavy'))
const rows = useMemo(() => expensiveSort(data), [data])

startTransition(() => setFilter(next)) // keeps typing responsive`,
          },
        ],
      },
      nextjs: {
        note: 'Move work off the client entirely: do the heavy computation in a Server Component or Server Action, and `next/dynamic`-import client-only heavy widgets so they don’t block first interaction.',
        code: [
          {
            lang: 'tsx',
            code: `import dynamic from 'next/dynamic'
const Chart = dynamic(() => import('./Chart'), { ssr: false, loading: () => <Skeleton /> })`,
          },
        ],
      },
      vanilla: {
        note: 'Offload pure computation to a Web Worker so the main thread stays free for input and paint.',
        code: [
          {
            lang: 'js',
            code: `const worker = new Worker(new URL('./crunch.js', import.meta.url), { type: 'module' })
worker.postMessage(data)
worker.onmessage = (e) => render(e.data)`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What counts as a long task?',
        a: 'The browser flags any task that occupies the main thread for 50ms or more. VibeCheck goes further and attributes long animation frames back to the specific script responsible, so you know what to fix.',
      },
      {
        q: 'When should I use a Web Worker vs chunking?',
        a: 'Use a Worker for pure, CPU-bound computation with no DOM access (parsing, crunching, transforming data). Use chunking/yielding when the work must touch the DOM or React state and can be spread across frames.',
      },
      {
        q: 'How does this relate to INP?',
        a: 'INP measures how long the page takes to visually respond to an interaction. Long tasks are the main cause of poor INP — while a long task runs, the browser can’t process the click or paint the response.',
      },
    ],
    related: ['large-javascript-bundles', 'heavy-dependencies', 'excessive-dom-size', 'cumulative-layout-shift'],
  },

  {
    slug: 'console-log-spam',
    category: 'performance',
    detector: 'console-spam',
    severity: 'warning',
    title: 'Fix console.log spam in production',
    metaDescription:
      'Debug logs left in production leak internals, slow hot paths, and bury real errors. Strip them at build time and add a no-console lint rule.',
    h1: 'Console.log spam',
    pain: 'Debug logs left in shipped code serialize their arguments on every call, add DevTools overhead, and in a hot path (a render loop, a scroll handler) they measurably slow the page. They also leak app internals to anyone who opens the console and bury the one real error under noise. Vibe-coded features accumulate these fast, because logging is how the agent "sees" while it works — and it rarely cleans up.',
    symptoms: [
      'The console is a wall of messages on a normal page load',
      'App state, tokens, or payloads are visible to anyone who opens DevTools',
      'A genuine error is impossible to find in the noise',
      'Perceptible slowdown in loops that log on every iteration',
    ],
    detection: {
      detector: 'console-spam',
      issueString: 'console.log spam detected',
      threshold: '> 20 console calls within a rolling 10s window',
    },
    rootCauses: [
      'Debug `console.log` statements never removed after a feature shipped',
      'A verbose third-party library logging at its default level',
      'Logging inside a render, effect, or scroll/resize handler that fires constantly',
    ],
    fix: {
      summary:
        'Strip console output at build time for production, keep intentional error reporting behind a level-aware logger, and add an ESLint `no-console` rule so new debug logs can’t be merged. Configure noisy libraries down to warn/error.',
      steps: [
        'Enable build-time console stripping for production builds',
        'Replace ad-hoc logs with a logger that is silent in production',
        'Add the ESLint `no-console` rule (allowing warn/error) to prevent regressions',
      ],
      code: [
        {
          lang: 'json',
          caption: '.eslintrc — block new debug logs',
          code: `{ "rules": { "no-console": ["error", { "allow": ["warn", "error"] }] } }`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Next.js can remove console calls from production bundles with a compiler option — keep error so real failures still report.',
        docsUrl: 'https://nextjs.org/docs/architecture/nextjs-compiler#remove-console',
        code: [
          {
            lang: 'js',
            caption: 'next.config.js',
            code: `module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
}`,
          },
        ],
      },
      react: {
        note: 'Vite (and esbuild-based React setups) can drop console and debugger from production builds at the bundler level.',
        code: [
          {
            lang: 'ts',
            caption: 'vite.config.ts',
            code: `export default defineConfig({
  esbuild: { drop: ['console', 'debugger'] },
})`,
          },
        ],
      },
      vue: {
        note: 'Vue’s Vite setup uses the same esbuild drop option to strip console output in production.',
        code: [
          {
            lang: 'ts',
            caption: 'vite.config.ts',
            code: `export default defineConfig({
  esbuild: { drop: ['console', 'debugger'] },
})`,
          },
        ],
      },
      vanilla: {
        note: 'If you bundle with Terser/Rollup, enable `drop_console` for production. Otherwise gate logs behind a DEV flag.',
        code: [
          {
            lang: 'js',
            caption: 'terser options',
            code: `terser({ compress: { drop_console: true } })`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Should I remove `console.error` too?',
        a: 'No — keep `console.error` (and usually `console.warn`) so genuine failures still surface. Strip only the debug-level `console.log`/info/debug noise. The examples here exclude error on purpose.',
      },
      {
        q: 'Is `console.log` actually a performance problem?',
        a: 'In a hot path, yes. Each call serializes its arguments and incurs DevTools overhead. One log on click is nothing; a log inside a scroll handler or render loop firing hundreds of times a second is measurable.',
      },
      {
        q: 'How does VibeCheck count this?',
        a: 'It wraps `console.log`/warn/error and counts calls in a rolling 10-second window. More than 20 in that window trips the console-spam detector.',
      },
    ],
    related: ['memory-leak', 'duplicate-network-requests', 'long-tasks', 'large-javascript-bundles'],
  },

  {
    slug: 'duplicate-network-requests',
    category: 'performance',
    detector: 'duplicate-requests',
    severity: 'warning',
    title: 'Fix duplicate network requests',
    metaDescription:
      'The same endpoint fetched several times wastes bandwidth and risks race conditions. Deduplicate with a query cache or a shared in-flight request.',
    h1: 'Duplicate network requests',
    pain: 'When several components each fetch the same endpoint, you pay for the same data multiple times — wasted bandwidth, extra server load, slower time-to-content, and the risk that responses arrive out of order and overwrite each other. It is endemic in AI-built frontends because each component is generated in isolation, so each one fetches what it needs independently instead of sharing.',
    symptoms: [
      'The Network panel shows the same URL requested several times in a burst',
      'A list and its header both fetch the same resource on mount',
      'Occasional flicker or stale data from responses racing each other',
      'Server logs show duplicate reads for one page view',
    ],
    detection: {
      detector: 'duplicate-requests',
      issueString: 'Duplicate GET request',
      threshold: 'The same method + URL requested 2 or more times within 2 seconds',
    },
    rootCauses: [
      'Multiple components fetching the same endpoint independently on mount',
      'No request deduplication or client-side cache in front of the data layer',
      'An effect re-running on every render because its dependencies aren’t stable',
      'Rapid-fire calls from search/autocomplete without debouncing',
    ],
    fix: {
      summary:
        'Put a caching data layer in front of your fetches so identical in-flight requests are deduplicated and results are shared. Lift shared data to a common parent, cache responses, debounce rapid-fire inputs, and set sensible `Cache-Control` headers on the API.',
      steps: [
        'Adopt a query cache (or a shared in-flight promise map) that dedupes by key',
        'Give the same resource the same query key everywhere it’s used',
        'Debounce search/autocomplete and cache responses on the server',
      ],
      code: [
        {
          lang: 'js',
          caption: 'Framework-free: share the in-flight promise by key',
          code: `const inFlight = new Map()
function dedupedFetch(url) {
  if (!inFlight.has(url)) {
    inFlight.set(url, fetch(url).then((r) => r.json()).finally(() => inFlight.delete(url)))
  }
  return inFlight.get(url)
}`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'TanStack Query (or SWR) deduplicates requests that share a query key automatically — ten components asking for the same key trigger one fetch and share the cached result.',
        docsUrl: 'https://tanstack.com/query/latest',
        code: [
          {
            lang: 'tsx',
            code: `import { useQuery } from '@tanstack/react-query'

// Every component using this key shares ONE request + cache entry.
const { data } = useQuery({ queryKey: ['user', id], queryFn: () => fetchUser(id) })`,
          },
        ],
      },
      nextjs: {
        note: 'In Server Components, wrap the fetcher in React’s `cache()` so repeat calls in one render dedupe; native `fetch` is also automatically memoized per request. That removes duplicate reads without a client cache.',
        docsUrl: 'https://nextjs.org/docs/app/deep-dive/caching#request-memoization',
        code: [
          {
            lang: 'tsx',
            code: `import { cache } from 'react'
export const getUser = cache(async (id: string) => {
  const res = await fetch(\`/api/users/\${id}\`)
  return res.json()
}) // called in many components → fetched once per request`,
          },
        ],
      },
      vue: {
        note: 'Use `@tanstack/vue-query` for the same key-based dedup, or hoist the fetch into a Pinia store so components read shared state instead of refetching.',
        docsUrl: 'https://tanstack.com/query/latest/docs/framework/vue/overview',
        code: [
          {
            lang: 'vue',
            code: `<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
const { data } = useQuery({ queryKey: ['user', props.id], queryFn: () => fetchUser(props.id) })
</script>`,
          },
        ],
      },
      svelte: {
        note: 'In SvelteKit, fetch shared data once in a load function and let child routes read it, rather than fetching in each component. load’s fetch also dedupes and can be cached.',
        docsUrl: 'https://svelte.dev/docs/kit/load',
        code: [
          {
            lang: 'ts',
            caption: '+page.ts — one load, shared down the tree',
            code: `export async function load({ fetch, params }) {
  const user = await fetch(\`/api/users/\${params.id}\`).then((r) => r.json())
  return { user }
}`,
          },
        ],
      },
      vanilla: {
        note: 'Keep a Map of in-flight promises keyed by URL so concurrent callers share one request, and cache resolved results with a short TTL.',
        code: [
          {
            lang: 'js',
            code: `const cache = new Map()
export function getJSON(url) {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => r.json()))
  return cache.get(url)
}`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is fetching the same URL twice always a bug?',
        a: 'Not always — polling or intentional revalidation is fine. VibeCheck flags the same method+URL hitting 2+ times within 2 seconds, which almost always means two components fetched independently rather than sharing.',
      },
      {
        q: 'Does HTTP caching solve this?',
        a: '`Cache-Control` helps the browser reuse responses, but the requests are still made and can still race. Client-side dedup (a query cache or shared promise) prevents the duplicate calls in the first place.',
      },
      {
        q: 'Why do my duplicates come in bursts on mount?',
        a: 'Because several components mount together and each kicks off its own fetch. Sharing one query key (or lifting the fetch to a parent/loader) collapses them into a single request.',
      },
    ],
    related: ['large-javascript-bundles', 'console-log-spam', 'memory-leak', 'content-requires-javascript'],
  },
]
