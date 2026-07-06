import type { Problem } from './types'

// ── Asset / bundle performance problems ──────────────────────────────────────
// Image and JavaScript payload detectors. Source: packages/core/src/detectors/
// {unoptimizedImages,largeImages,resourceBloat,heavyLibrary}.ts.

export const performanceAssetProblems: readonly Problem[] = [
  {
    slug: 'unoptimized-images',
    category: 'performance',
    detector: 'unoptimized-images',
    severity: 'error',
    title: 'Fix unoptimized images (dimensions, lazy, size)',
    metaDescription:
      'Images without dimensions shift layout; oversized ones waste bandwidth. Add width/height, lazy-load below the fold, and serve the right size.',
    h1: 'Unoptimized images',
    pain: 'Images are usually the heaviest thing on a page, and when they ship without width/height they shift the layout as they load, when they ship at 2400px in a 400px slot they waste most of what they download, and when they load eagerly below the fold they steal bandwidth from what’s actually visible. AI scaffolds paste raw <img src> tags with none of the attributes that make images fast.',
    symptoms: [
      'Layout jumps as each image loads (no reserved space)',
      'A tiny thumbnail downloads a multi-megapixel original',
      'Below-the-fold images load immediately, delaying the hero',
      'Images look slightly stretched or squished (wrong declared ratio)',
    ],
    detection: {
      detector: 'unoptimized-images',
      issueString: 'hero.png (2400×1200) missing width/height',
      threshold: 'Natural size > 2× rendered size, or declared aspect ratio off by > 0.15, or missing dimensions/lazy/alt',
    },
    rootCauses: [
      'No width/height attributes, so the browser can’t reserve space',
      'The source image is far larger than the size it’s displayed at',
      'No loading="lazy" on images below the fold',
      'Declared width/height that don’t match the file’s real aspect ratio',
    ],
    fix: {
      summary:
        'Give every image explicit intrinsic width and height so the box is reserved before load, add loading="lazy" to below-the-fold images, serve the image at roughly the size it’s displayed (2× max for retina) in a modern format (WebP/AVIF), and use srcset/sizes for responsive delivery.',
      steps: [
        'Add width and height attributes matching the file’s real aspect ratio',
        'Add loading="lazy" to images below the fold (never to the LCP image)',
        'Resize and re-encode to WebP/AVIF at the displayed size, with srcset for density',
      ],
      code: [
        {
          lang: 'html',
          caption: 'Responsive, non-shifting, right-sized image',
          code: `<img
  src="/hero-800.webp"
  srcset="/hero-800.webp 800w, /hero-1600.webp 1600w"
  sizes="(max-width: 600px) 100vw, 800px"
  width="800" height="450"
  loading="lazy" decoding="async"
  alt="Product dashboard" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'next/image does all of this for you: it reserves space from width/height, lazy-loads by default, generates WebP/AVIF and a srcset, and serves the right size per device. Set priority on the LCP image so it isn’t lazy-loaded.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/components/image',
        code: [
          {
            lang: 'tsx',
            code: `import Image from 'next/image'

<Image src="/hero.jpg" width={800} height={450} alt="Product dashboard" priority />`,
          },
        ],
      },
      react: {
        note: 'Plain React has no image pipeline, so add the attributes yourself — width/height, loading, decoding — and pre-generate responsive sizes at build time or via an image CDN.',
        code: [
          {
            lang: 'tsx',
            code: `<img
  src="/hero-800.webp"
  width={800}
  height={450}
  loading="lazy"
  decoding="async"
  alt="Product dashboard"
/>`,
          },
        ],
      },
      vue: {
        note: 'Set the same attributes in the template. On Nuxt, use <NuxtImg> from @nuxt/image for automatic resizing and modern formats.',
        docsUrl: 'https://image.nuxt.com/',
        code: [
          {
            lang: 'vue',
            code: `<template>
  <img src="/hero-800.webp" width="800" height="450" loading="lazy" alt="Product dashboard" />
  <!-- Nuxt: <NuxtImg src="/hero.jpg" width="800" height="450" loading="lazy" /> -->
</template>`,
          },
        ],
      },
      svelte: {
        note: '@sveltejs/enhanced-img processes local images at build time — generating dimensions, modern formats, and a srcset from a single <enhanced:img> tag.',
        docsUrl: 'https://svelte.dev/docs/kit/images',
        code: [
          {
            lang: 'svelte',
            code: `<script>
  import hero from '$lib/hero.jpg?enhanced'
</script>

<enhanced:img src={hero} alt="Product dashboard" />`,
          },
        ],
      },
      vanilla: {
        note: 'Author the full attribute set by hand and pre-process images (squoosh, sharp, or a CDN) to the displayed size and a modern format.',
        code: [
          {
            lang: 'html',
            code: `<img src="/hero-800.webp" width="800" height="450" loading="lazy" decoding="async" alt="Product dashboard" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Should I lazy-load every image?',
        a: 'No — never lazy-load your LCP (largest, above-the-fold) image; that delays the most important paint. Lazy-load only images below the fold. In Next.js, mark the hero with priority.',
      },
      {
        q: 'What does "oversized" mean exactly?',
        a: 'VibeCheck flags an image whose natural (file) dimensions are more than twice its rendered (displayed) size — you’re downloading at least 4× the pixels you show. Resize to the displayed size, 2× for retina.',
      },
      {
        q: 'Why does missing width/height cause layout shift?',
        a: 'Without dimensions the browser doesn’t know the image’s size until it downloads, so it reserves no space and everything below jumps when the image arrives. The attributes let it reserve the box up front.',
      },
    ],
    related: ['large-image-files', 'cumulative-layout-shift', 'missing-image-alt-text', 'large-javascript-bundles'],
  },

  {
    slug: 'large-image-files',
    category: 'performance',
    detector: 'large-images',
    severity: 'error',
    title: 'Fix large image files slowing your page',
    metaDescription:
      'Multi-hundred-KB images blow your LCP and mobile data budget. Compress to WebP/AVIF, resize to display size, and serve from an image CDN.',
    h1: 'Large image files',
    pain: 'A single unoptimized hero image can be heavier than all your JavaScript combined, and it usually sits right in the critical path as the LCP element — so a fat image directly slows the metric Google measures your loading speed on. On mobile data it’s money out of the user’s pocket. AI-built pages routinely embed full-resolution PNGs and un-compressed exports.',
    symptoms: [
      'One image is several hundred KB to multiple MB in the Network panel',
      'Slow LCP (Largest Contentful Paint), especially on mobile',
      'A PNG used where a compressed WebP/AVIF would be a fraction of the size',
      'The hero takes a visible beat to appear on a throttled connection',
    ],
    detection: {
      detector: 'large-images',
      issueString: 'Large image: 512KB',
      threshold: '≥ 500KB transferred (warning), ≥ 1,024KB (error) — measured via Resource Timing',
    },
    rootCauses: [
      'Uncompressed PNG/JPEG exported straight from a design tool',
      'A full-resolution original served where a resized copy would do',
      'No modern format (WebP/AVIF), which compress far better than PNG/JPEG',
      'No image CDN doing on-the-fly compression and format negotiation',
    ],
    fix: {
      summary:
        'Compress and re-encode heavy images to WebP or AVIF (typically 30–80% smaller than PNG/JPEG at the same quality), resize them to no more than 2× their displayed dimensions, and ideally serve them through an image CDN that negotiates format and size per request. Use <picture> to offer AVIF with fallbacks.',
      steps: [
        'Resize the source to at most 2× the size it’s displayed at',
        'Re-encode to AVIF/WebP with a quality around 75–80',
        'Serve via <picture> with fallbacks, or through an image CDN',
      ],
      code: [
        {
          lang: 'html',
          caption: 'Offer AVIF → WebP → JPEG fallback',
          code: `<picture>
  <source type="image/avif" srcset="/hero.avif" />
  <source type="image/webp" srcset="/hero.webp" />
  <img src="/hero.jpg" width="800" height="450" alt="Hero" />
</picture>`,
        },
        {
          lang: 'bash',
          caption: 'Batch-compress with sharp',
          code: `npx sharp-cli -i hero.png -o hero.avif --avif quality=75`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'next/image compresses and converts to AVIF/WebP automatically and serves per-device sizes — pointing it at a large source and letting it optimize is usually the whole fix.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/components/image',
        code: [
          {
            lang: 'tsx',
            code: `import Image from 'next/image'
// Next generates optimized AVIF/WebP variants at request time.
<Image src="/hero-original.png" width={800} height={450} alt="Hero" />`,
          },
        ],
      },
      vue: {
        note: 'On Nuxt, @nuxt/image compresses and reformats at build/request time. Plain Vue: pre-compress and use <picture> as above.',
        docsUrl: 'https://image.nuxt.com/',
        code: [
          {
            lang: 'vue',
            code: `<template>
  <NuxtImg src="/hero-original.png" format="avif,webp" width="800" height="450" alt="Hero" />
</template>`,
          },
        ],
      },
      vanilla: {
        note: 'Pre-compress with sharp/squoosh in your build, then serve AVIF/WebP with a <picture> fallback. Or put an image CDN in front and pass width/format query params.',
        code: [
          {
            lang: 'bash',
            code: `# one-off or in your build step
npx @squoosh/cli --avif '{"quality":75}' hero.png`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What image size is acceptable?',
        a: 'Aim to keep individual images well under 200KB where you can. VibeCheck warns at 500KB and errors at 1MB — past that you’re almost certainly serving an un-resized or un-compressed original.',
      },
      {
        q: 'AVIF or WebP?',
        a: 'AVIF compresses better but encodes slower and has slightly less universal support; WebP is faster and near-universal. Offer AVIF first with a WebP (then JPEG) fallback via <picture>, and you get the best of both.',
      },
      {
        q: 'Does this affect SEO?',
        a: 'Yes, indirectly — a heavy hero image usually is your LCP element, and LCP is a Core Web Vital Google uses in ranking. Lighter images mean a faster LCP and a better page-experience signal.',
      },
    ],
    related: ['unoptimized-images', 'cumulative-layout-shift', 'large-javascript-bundles', 'missing-image-alt-text'],
  },

  {
    slug: 'large-javascript-bundles',
    category: 'performance',
    detector: 'resource-bloat',
    severity: 'warning',
    title: 'Fix large JavaScript bundles',
    metaDescription:
      'Oversized JS bundles delay interactivity and waste mobile data. Code-split by route, tree-shake imports, and lazy-load heavy components.',
    h1: 'Large JavaScript bundles',
    pain: 'Every kilobyte of JavaScript has to be downloaded, parsed, compiled, and executed before the page is interactive — and on a mid-range phone that work is many times slower than on your laptop. When one bundle ships the whole app up front, first interaction is delayed for everyone. AI-built apps balloon here by importing entire libraries for one helper and never code-splitting by route.',
    symptoms: [
      'A single .js chunk is hundreds of KB or more in the Network panel',
      'Slow time-to-interactive; the page looks ready but doesn’t respond yet',
      'The whole app’s code loads on the first route, before it’s needed',
      'A bundle analyzer shows one or two dependencies dominating the graph',
    ],
    detection: {
      detector: 'resource-bloat',
      issueString: 'Large JS resource (250KB)',
      threshold: '≥ 100KB transferred per JS/CSS resource in production (≥ 500KB in dev)',
    },
    rootCauses: [
      'No route-level code splitting — the entire app ships in one chunk',
      'Barrel/whole-library imports that defeat tree-shaking',
      'Heavy components (editors, charts, maps) bundled into the initial load',
      'Duplicate copies of a dependency at different versions',
    ],
    fix: {
      summary:
        'Split code so each route and heavy component loads on demand, import only what you use so tree-shaking can drop the rest, and run a bundle analyzer to find the biggest offenders. Ensure the server sends gzip/brotli-compressed assets.',
      steps: [
        'Run a bundle analyzer to identify the largest chunks and dependencies',
        'Code-split by route and lazy-load heavy, non-critical components',
        'Replace whole-library imports with named/deep imports and remove duplicates',
      ],
      code: [
        {
          lang: 'js',
          caption: 'Import only what you use (tree-shakeable)',
          code: `// ✗ pulls the whole library into the bundle
import _ from 'lodash'
// ✓ only debounce ships
import debounce from 'lodash-es/debounce'`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Split at route and component boundaries with React.lazy + Suspense, and analyze the build with rollup-plugin-visualizer (Vite) to see what’s big.',
        docsUrl: 'https://react.dev/reference/react/lazy',
        code: [
          {
            lang: 'tsx',
            code: `import { lazy, Suspense } from 'react'
const Editor = lazy(() => import('./Editor')) // its own chunk, loaded on demand

<Suspense fallback={<Skeleton />}>
  <Editor />
</Suspense>`,
          },
        ],
      },
      nextjs: {
        note: 'Next code-splits per route automatically; use next/dynamic for heavy client components and @next/bundle-analyzer to inspect chunks. Prefer Server Components so code never reaches the client.',
        docsUrl: 'https://nextjs.org/docs/app/guides/lazy-loading',
        code: [
          {
            lang: 'tsx',
            code: `import dynamic from 'next/dynamic'
const Map = dynamic(() => import('./Map'), { ssr: false, loading: () => <Skeleton /> })`,
          },
        ],
      },
      vue: {
        note: 'Use defineAsyncComponent for on-demand components and Vue Router’s dynamic imports for route-level splitting.',
        docsUrl: 'https://vuejs.org/guide/components/async.html',
        code: [
          {
            lang: 'ts',
            code: `import { defineAsyncComponent } from 'vue'
const Editor = defineAsyncComponent(() => import('./Editor.vue'))

// route-level split:
const routes = [{ path: '/edit', component: () => import('./pages/Edit.vue') }]`,
          },
        ],
      },
      vanilla: {
        note: 'Use dynamic import() to load heavy modules only when needed; modern bundlers split them into separate chunks automatically.',
        code: [
          {
            lang: 'js',
            code: `button.addEventListener('click', async () => {
  const { openEditor } = await import('./editor.js') // separate chunk
  openEditor()
})`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Why is the threshold higher in development?',
        a: 'Dev bundles are unminified and include source maps and HMR runtime, so they’re legitimately large. VibeCheck raises the bar to 500KB on localhost and uses 100KB for production, where the size actually ships to users.',
      },
      {
        q: 'What’s the fastest win?',
        a: 'Route-level code splitting. It ensures a user landing on one page doesn’t download the code for every other page. After that, lazy-load the heaviest individual components (editors, charts, maps).',
      },
      {
        q: 'How do I find what’s making the bundle big?',
        a: 'Run a bundle analyzer (@next/bundle-analyzer, rollup-plugin-visualizer, or source-map-explorer). It shows a treemap of every module so you can spot an oversized dependency or an accidental whole-library import.',
      },
    ],
    related: ['heavy-dependencies', 'long-tasks', 'duplicate-network-requests', 'excessive-dom-size'],
  },

  {
    slug: 'heavy-dependencies',
    category: 'performance',
    detector: 'heavy-library',
    severity: 'warning',
    title: 'Fix heavy libraries hurting performance',
    metaDescription:
      'Heavy libraries add weight and known pitfalls. Lazy-load them, import a lighter subset, or swap for a native API to cut bundle size and jank.',
    h1: 'Heavy dependencies',
    pain: 'Some libraries are heavy enough that pulling one in for a small feature dominates your bundle and brings its own performance footguns — 3D engines that leak GPU memory, animation libraries that read layout every frame, date libraries many times larger than the native alternative. AI agents reach for whatever library they’ve seen most, so a marketing page ends up shipping a full charting or animation runtime for one small effect.',
    symptoms: [
      'One dependency accounts for a large share of the bundle',
      'A heavy runtime (Three.js, Framer Motion, Moment) loads on a page that barely uses it',
      'Known pitfalls: undisposed resources, per-frame layout reads, un-tree-shaken imports',
      'The bundle analyzer shows a single package dwarfing the rest',
    ],
    detection: {
      detector: 'heavy-library',
      issueString: 'Framer Motion detected (58KB)',
      threshold: 'Matches one of 16 known heavy-library signatures (globals, DOM patterns, or script URLs)',
    },
    rootCauses: [
      'A large library imported for one small feature',
      'Importing the whole library instead of a tree-shakeable subset',
      'The library loaded eagerly on a page that only uses it conditionally',
      'A dated heavyweight (e.g. Moment.js) where a modern/native option exists',
    ],
    fix: {
      summary:
        'For each heavy library, decide: replace it with a native API or a lighter alternative, import only the slice you need so tree-shaking works, or lazy-load it so it’s fetched only when the feature is actually used. Confirm resources are disposed on unmount.',
      steps: [
        'Identify the heavy library and how much of it you actually use',
        'Replace with a native/lighter option, or import a tree-shakeable subset',
        'If it must stay, lazy-load it and dispose its resources on teardown',
      ],
      code: [
        {
          lang: 'js',
          caption: 'Often the library isn’t needed at all',
          code: `// ✗ Moment.js (~70KB) for one formatted date
import moment from 'moment'
moment(d).format('LL')
// ✓ native Intl — zero bytes shipped
new Intl.DateTimeFormat('en', { dateStyle: 'long' }).format(d)`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Load heavy widgets on demand with React.lazy, and use a library’s lightweight entry when it has one — e.g. Framer Motion’s LazyMotion ships ~5KB instead of the full bundle.',
        docsUrl: 'https://motion.dev/docs/react-reduce-bundle-size',
        code: [
          {
            lang: 'tsx',
            code: `import { LazyMotion, domAnimation, m } from 'framer-motion'

<LazyMotion features={domAnimation}>
  <m.div animate={{ opacity: 1 }} /> {/* ~5KB, not ~58KB */}
</LazyMotion>`,
          },
        ],
      },
      nextjs: {
        note: 'Dynamic-import client-only heavy libraries with ssr:false so they never touch the server bundle or block first paint, and load them behind interaction where possible.',
        code: [
          {
            lang: 'tsx',
            code: `import dynamic from 'next/dynamic'
const Globe = dynamic(() => import('./Globe'), { ssr: false }) // Three.js stays out of initial JS`,
          },
        ],
      },
      vanilla: {
        note: 'Dynamically import the library the first time the feature runs, and always dispose its resources (geometries, listeners, timelines) when you’re done to avoid leaks.',
        code: [
          {
            lang: 'js',
            code: `let mod
async function animate() {
  mod ??= await import('gsap')
  const tween = mod.gsap.to(el, { x: 100 })
  return () => tween.kill() // dispose to avoid a leak
}`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Which libraries does VibeCheck flag?',
        a: 'It fingerprints 16 known-heavy libraries — 3D engines, animation runtimes, charting, CSS-in-JS, date and utility libraries — by their globals, DOM markers, or script URLs, and reports the weight plus that library’s common pitfalls.',
      },
      {
        q: 'Do I have to remove the library?',
        a: 'Not necessarily. Often lazy-loading it (so only users who need the feature download it) or importing a lighter subset is enough. Removal only makes sense when a native API or a much smaller package fully covers your use.',
      },
      {
        q: 'What’s the single most common heavy dependency?',
        a: 'Date libraries and animation runtimes. Moment.js is a classic — the native Intl.DateTimeFormat replaces most of it for zero bytes — and animation libraries are frequently shipped in full when a tree-shaken or lazy subset would do.',
      },
    ],
    related: ['large-javascript-bundles', 'long-tasks', 'memory-leak', 'cumulative-layout-shift'],
  },
]
