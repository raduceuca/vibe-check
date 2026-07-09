import type { Problem } from './types'

// ── AEO content-readability problems ─────────────────────────────────────────
// "Answer Engine Optimization" — can AI answer engines (ChatGPT, Perplexity,
// Claude, Google AI Overviews) read and trust this page? Source: packages/core/
// src/detectors/aeo.ts and AEO_FIXES / AEO_VIBE in suggestions/index.ts.

export const aeoContentProblems: readonly Problem[] = [
  {
    slug: 'missing-structured-data',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'structured-data-missing',
    severity: 'warning',
    title: 'Fix missing structured data (JSON-LD)',
    metaDescription:
      'Answer engines extract facts from schema.org JSON-LD. Without it they guess from prose. Add JSON-LD so AI and Google read your page correctly.',
    h1: 'Missing structured data (JSON-LD)',
    pain: 'Answer engines and rich-result crawlers pull entities, facts, and answers out of `schema.org` `JSON-LD` — an author, a price, a rating, a FAQ. Without it they fall back to guessing from your prose, which is lossy and easy to get wrong. As AI assistants become how people find things, a page with no machine-readable summary is one they’re more likely to skip or misquote.',
    symptoms: [
      'No rich results (FAQ, breadcrumb, product, article) in Google',
      'AI assistants summarise the page inaccurately or not at all',
      'Google’s Rich Results Test reports "No items detected"',
      'Competitors with the same content show richer search snippets',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'No structured data (JSON-LD)',
      threshold: 'No <script type="application/ld+json"> present on the page',
    },
    rootCauses: [
      'No `JSON-LD` was ever added to the templates',
      'Relying on Open Graph/meta tags alone, which don’t describe entities',
      'A CMS or generator that outputs prose but no schema',
    ],
    fix: {
      summary:
        'Add a `<script type="application/ld+json">` describing the page with the `schema.org` type that fits — `Article`/`TechArticle` for content, `Product` for a product, `FAQPage` for a Q&A, `Organization` for the site. Include a `@context` of `https://schema.org` and the fields relevant to that type.',
      steps: [
        'Pick the `schema.org` type that matches the page (`Article`, `Product`, `FAQPage`, …)',
        'Emit a `JSON-LD` script with `@context` `"https://schema.org"` and the key fields',
        'Validate with Google’s Rich Results Test and `schema.org` validator',
      ],
      code: [
        {
          lang: 'html',
          caption: 'A minimal Article JSON-LD',
          code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "How to fix cumulative layout shift",
  "author": { "@type": "Person", "name": "Jane Dev" },
  "datePublished": "2026-01-15"
}
</script>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Render the `JSON-LD` as a `<script>` in the component tree (Server Component). Next streams it into the HTML so crawlers see it without running JS. Build the object in TypeScript and stringify it.',
        docsUrl: 'https://nextjs.org/docs/app/guides/json-ld',
        code: [
          {
            lang: 'tsx',
            code: `export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How to fix CLS',
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article>…</article>
    </>
  )
}`,
          },
        ],
      },
      react: {
        note: 'In React 19 a `<script>` in your component is hoisted correctly, but for crawlers that don’t run JS you should render it during SSR/prerender. Stringify the object rather than hand-writing JSON.',
        code: [
          {
            lang: 'tsx',
            code: `const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline: title }
return <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>`,
          },
        ],
      },
      vue: {
        note: 'Inject the script with `@unhead/vue`’s `useHead` so it lands in `<head>` during SSR.',
        docsUrl: 'https://unhead.unjs.io/',
        code: [
          {
            lang: 'vue',
            code: `<script setup lang="ts">
import { useHead } from '@unhead/vue'
useHead({
  script: [{ type: 'application/ld+json', innerHTML: JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article', headline: 'How to fix CLS',
  }) }],
})
</script>`,
          },
        ],
      },
      svelte: {
        note: 'Place the `JSON-LD` in `<svelte:head>`; SvelteKit renders it server-side so crawlers see it.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  {@html '<script type="application/ld+json">' + JSON.stringify(jsonLd) + '<\\/script>'}
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Emit the script directly in server-rendered HTML (or static HTML). Keep it in the markup so non-JS crawlers read it.',
        code: [
          {
            lang: 'html',
            code: `<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "Organization", "name": "Acme", "url": "https://acme.com" }
</script>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Which `schema.org` type should I use?',
        a: 'Match the page: `Article`/`TechArticle`/`BlogPosting` for content, `Product` for a product, `FAQPage` for Q&A, `Organization`/`WebSite` for the site itself. You can include several types on one page.',
      },
      {
        q: 'Does `JSON-LD` help with AI answer engines specifically?',
        a: 'Yes. Assistants like ChatGPT, Perplexity, and Google’s AI Overviews extract structured facts far more reliably than prose. Clean `JSON-LD` makes your page easier to cite accurately.',
      },
      {
        q: '`JSON-LD`, Microdata, or RDFa?',
        a: 'Google recommends `JSON-LD` — it’s a single script block separate from your markup, so it’s the easiest to add and maintain, and it’s what VibeCheck checks for.',
      },
    ],
    related: ['invalid-structured-data', 'missing-author-metadata', 'missing-meta-description', 'content-requires-javascript'],
  },

  {
    slug: 'invalid-structured-data',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'structured-data-invalid',
    severity: 'warning',
    title: 'Fix invalid structured data (JSON-LD)',
    metaDescription:
      'Malformed JSON-LD is silently skipped by search and answer engines. Fix the syntax and schema.org @context so your structured data actually counts.',
    h1: 'Invalid structured data (JSON-LD)',
    pain: 'You added `JSON-LD`, but it’s malformed or missing its `schema.org` `@context`, so crawlers parse it, fail, and skip it — you get zero credit for the effort. This is worse than a silent miss because it looks done. Hand-authored or string-concatenated `JSON-LD` (common in AI output) is exactly where trailing commas and unescaped quotes creep in.',
    symptoms: [
      'Rich Results Test reports a parsing error or missing required field',
      'No rich results despite having a `JSON-LD` block on the page',
      'The script contains a trailing comma, unescaped quote, or wrong `@context`',
      'VibeCheck flags the `JSON-LD` as present but invalid',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'Structured data is invalid',
      threshold: 'A JSON-LD script exists but fails JSON.parse or doesn’t reference schema.org',
    },
    rootCauses: [
      'Invalid JSON — trailing commas, unescaped quotes, or comments',
      'Missing or wrong `"@context"`: `"https://schema.org"`',
      'String-concatenated `JSON-LD` instead of `JSON.stringify` of a real object',
      'Interpolated values that weren’t escaped for JSON',
    ],
    fix: {
      summary:
        'Build the structured data as a real JavaScript object and `JSON.stringify` it — never hand-concatenate JSON. Ensure the top-level `@context` is exactly `"https://schema.org"`, and validate the output. Stringifying guarantees valid escaping and no trailing commas.',
      steps: [
        'Replace hand-written JSON strings with `JSON.stringify` of a typed object',
        'Confirm `@context` is `"https://schema.org"` and `@type` is a valid type',
        'Run it through Google’s Rich Results Test until it passes clean',
      ],
      code: [
        {
          lang: 'ts',
          caption: 'Stringify an object — never concatenate JSON by hand',
          code: `// ✗ fragile: interpolation breaks on quotes/newlines in title
// \`{ "headline": "\${title}" }\`
// ✓ correct: stringify escapes everything
const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: title,
})`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Render with `JSON.stringify` and `dangerouslySetInnerHTML` so the value is properly escaped exactly once — don’t build the JSON as a template string.',
        code: [
          {
            lang: 'tsx',
            code: `<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>`,
          },
        ],
      },
      nextjs: {
        note: 'Render the `JSON-LD` from a Server Component with `JSON.stringify`. It runs server-side, so the escaped block ships in the initial HTML where crawlers read it — no client hydration needed.',
        docsUrl: 'https://nextjs.org/docs/app/guides/json-ld',
        code: [
          {
            lang: 'tsx',
            code: `export default function Page() {
  const jsonLd = { '@context': 'https://schema.org', '@type': 'Article', headline }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}`,
          },
        ],
      },
      vanilla: {
        note: 'If you template `JSON-LD` server-side, serialize with your language’s JSON encoder, not string interpolation, so quotes and Unicode are escaped.',
        code: [
          {
            lang: 'js',
            code: `res.write('<script type="application/ld+json">' + JSON.stringify(data) + '</script>')`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'How do I know what’s wrong with my `JSON-LD`?',
        a: 'Paste it into Google’s Rich Results Test or the `schema.org` validator — both point to the exact line and field. Most failures are a JSON syntax error or a missing `@context`.',
      },
      {
        q: 'Why does string interpolation cause invalid `JSON-LD`?',
        a: 'A title with a quote, apostrophe, or newline breaks the surrounding JSON when interpolated raw. `JSON.stringify` escapes those characters correctly, which is why building an object and stringifying it is the safe pattern.',
      },
      {
        q: 'Can I put several types in one `JSON-LD` block?',
        a: 'Yes — use an `@graph` array to declare multiple entities (for example an `Organization` and a `WebSite`) in a single script. Keep each node’s `@type` and required fields valid: one malformed node invalidates the whole block.',
      },
    ],
    related: ['missing-structured-data', 'missing-author-metadata', 'missing-llms-txt'],
  },

  {
    slug: 'missing-main-landmark',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'no-main-landmark',
    severity: 'info',
    title: 'Fix a missing <main> landmark',
    metaDescription:
      'Without a <main> landmark, assistants and screen readers can’t find your primary content. Wrap the main content in a single semantic <main>.',
    h1: 'Missing <main> landmark',
    pain: 'Landmarks like `<main>`, `<nav>`, and `<article>` tell assistive tech and content extractors where the primary content is, instead of forcing them to guess from a sea of `<div>`s. Screen-reader users jump straight to `<main>`; answer engines use it to separate content from chrome. AI scaffolds output `<div>`-only trees, so this signal is simply absent.',
    symptoms: [
      'Screen readers offer no "skip to main content" landmark',
      'The page is a tree of `<div>`s with no semantic regions',
      'Content extractors include nav/footer boilerplate as if it were content',
      'Accessibility audits flag "no main landmark"',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'No <main> landmark',
      threshold: 'document.querySelector("main") returns null',
    },
    rootCauses: [
      'The layout uses `<div>` everywhere instead of semantic elements',
      'A component library wraps content without a `<main>` region',
      'Multiple content areas but no single primary landmark',
    ],
    fix: {
      summary:
        'Wrap the primary content of each page in exactly one `<main>` element, and use `<nav>`, `<header>`, `<footer>`, and `<article>` for the surrounding regions. There should be one `<main>` per page, containing the content unique to that page (not the shared chrome).',
      steps: [
        'Identify the primary content region unique to the page',
        'Wrap it in a single `<main>` element',
        'Use `<nav>`/`<header>`/`<footer>` for the surrounding chrome',
      ],
      code: [
        {
          lang: 'html',
          code: `<body>
  <header><nav>…</nav></header>
  <main>
    <h1>Page title</h1>
    <!-- the content unique to this page -->
  </main>
  <footer>…</footer>
</body>`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Render a `<main>` in your layout around the routed content — one per page, wrapping only the page-specific content, not the shared nav/footer.',
        code: [
          {
            lang: 'tsx',
            code: `<>
  <SiteHeader />
  <main>{children}</main>
  <SiteFooter />
</>`,
          },
        ],
      },
      vue: {
        note: 'Use `<main>` around `<router-view>` (or the page content) in your app shell template.',
        code: [
          {
            lang: 'vue',
            code: `<template>
  <SiteHeader />
  <main><router-view /></main>
  <SiteFooter />
</template>`,
          },
        ],
      },
      svelte: {
        note: 'Wrap the page slot in `<main>` in your root `+layout.svelte`.',
        code: [
          {
            lang: 'svelte',
            code: `<SiteHeader />
<main>
  <slot />
</main>
<SiteFooter />`,
          },
        ],
      },
      vanilla: {
        note: 'Use the `<main>` element in your HTML structure and reserve `<div>` for styling-only wrappers.',
        code: [
          {
            lang: 'html',
            code: `<main id="content">
  <h1>…</h1>
</main>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Can I have more than one <main>?',
        a: 'Only one `<main>` should be visible per page. You may have multiple in the DOM if all but one are hidden, but the simplest and safest approach is exactly one visible `<main>` per page.',
      },
      {
        q: 'What goes inside <main> vs outside?',
        a: '`<main>` holds the content unique to this page. The site header, primary navigation, and footer are repeated across pages, so they belong in `<header>`, `<nav>`, and `<footer>` outside `<main>`.',
      },
    ],
    related: ['missing-h1-heading', 'missing-structured-data', 'missing-author-metadata', 'missing-image-alt-text'],
  },

  {
    slug: 'missing-author-metadata',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'no-author-metadata',
    severity: 'info',
    title: 'Fix missing author and date metadata',
    metaDescription:
      'Answer engines weigh authorship and freshness when choosing sources. Add author and published-date signals so your content is trusted and cited.',
    h1: 'Missing author and date signals',
    pain: 'Answer engines and search rankers weigh who wrote something and when when deciding which sources to trust and cite — E-E-A-T in Google’s terms. A page with no author and no date reads as anonymous and undated, which is exactly what ranking systems discount. AI-generated content pages almost never emit these signals.',
    symptoms: [
      'No visible or machine-readable author on articles',
      'No published or modified date on time-sensitive content',
      'Assistants can’t attribute or date the page when citing it',
      'Content reads as anonymous, hurting E-E-A-T signals',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'No author or date signals',
      threshold: 'No meta[name="author"], article:author, or [itemprop="author"] found',
    },
    rootCauses: [
      'No author or date metadata in the page head or schema',
      'Dates rendered only as display text with no machine-readable markup',
      'A template that omits authorship entirely',
    ],
    fix: {
      summary:
        'Add author and date signals in two places: a meta author tag (and/or `article:author`), and inside your `JSON-LD` as author plus `datePublished` / `dateModified`. Use a machine-readable `<time datetime>` for visible dates.',
      steps: [
        'Add `<meta name="author">` and `article:published_time` to the head',
        'Include author, `datePublished`, and `dateModified` in your `Article` `JSON-LD`',
        'Mark visible dates up with `<time datetime="…">`',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta name="author" content="Jane Dev" />
<meta property="article:published_time" content="2026-01-15T09:00:00Z" />
<time datetime="2026-01-15">January 15, 2026</time>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set authors and publish/modified times through the Metadata API — Next renders the appropriate meta tags. Add matching fields to your `Article` `JSON-LD` too.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata#authors',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  authors: [{ name: 'Jane Dev', url: 'https://example.com/jane' }],
  openGraph: { type: 'article', publishedTime: '2026-01-15T09:00:00Z' },
}`,
          },
        ],
      },
      react: {
        note: 'Render the author/date meta tags in your head manager and include them in the page’s `JSON-LD`.',
        code: [
          {
            lang: 'tsx',
            code: `<meta name="author" content={post.author} />
<meta property="article:published_time" content={post.publishedAt} />`,
          },
        ],
      },
      vue: {
        note: 'Add the meta tags with `useHead`, and include author/dates in your `JSON-LD` script.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ meta: [
  { name: 'author', content: post.author },
  { property: 'article:published_time', content: post.publishedAt },
] })`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What is E-E-A-T and how does this help?',
        a: 'Experience, Expertise, Authoritativeness, Trust — Google’s framework for judging content quality. Clear authorship and dates are concrete signals that feed it, and answer engines use the same cues to decide what to cite.',
      },
      {
        q: 'Do I need both meta tags and `JSON-LD`?',
        a: 'Belt and braces. Meta/OG tags are widely read; `JSON-LD` author and `datePublished` are what rich-result and answer engines prefer. Providing both maximises the chance your authorship is picked up.',
      },
    ],
    related: ['missing-structured-data', 'missing-meta-description', 'missing-main-landmark', 'missing-llms-txt'],
  },

  {
    slug: 'content-requires-javascript',
    category: 'aeo',
    detector: 'aeo',
    checkId: 'content-requires-js',
    severity: 'warning',
    title: 'Fix content that only renders with JavaScript',
    metaDescription:
      'Crawlers and AI agents that don’t run JS see an empty page. Server-render or prerender your content so it’s in the HTML, not built client-side.',
    h1: 'Content only renders with JavaScript',
    pain: 'When the HTML your server sends is an empty shell and all the content is painted by JavaScript in the browser, any crawler or agent that doesn’t execute JS — many AI answer engines, some social scrapers, low-power bots — sees a blank page. Client-only SPAs (a very common AI default with plain Vite/CRA) are invisible to exactly the audiences AEO is about.',
    symptoms: [
      '"View source" shows an empty `<div id="root">` and no real content',
      'Answer engines and some crawlers can’t read or cite the page',
      'Link previews (Slack, iMessage) are blank or show only the shell',
      'VibeCheck reports almost no text in the raw server HTML',
    ],
    detection: {
      detector: 'aeo',
      issueString: 'Content only renders with JavaScript',
      threshold: 'The raw server HTML contains fewer than 200 characters of body text',
    },
    rootCauses: [
      'A client-only SPA (Vite/CRA) that renders entirely in the browser',
      'No SSR, SSG, or prerendering step in the build',
      'Content fetched client-side after an empty initial paint',
    ],
    fix: {
      summary:
        'Render meaningful content into the HTML on the server or at build time. Use SSR (render per request), SSG/prerendering (render at build), or at minimum a static, crawlable fallback in the HTML. The goal: the important text is present in view-source, before any JavaScript runs.',
      steps: [
        'Adopt a framework mode that emits HTML (SSR or static generation)',
        'Ensure the primary content is in the server response, not fetched after load',
        'Verify with “view source” (or `curl`) that the text is present without JS',
      ],
      code: [
        {
          lang: 'bash',
          caption: 'Verify: real content must be in the raw HTML',
          code: `curl -s https://your-site.com/page | grep -o '<h1>.*</h1>'`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Use Server Components (the App Router default) or `generateStaticParams` for static generation — both put content in the HTML. Avoid pushing whole pages behind `"use client"` with client-side data fetching.',
        docsUrl: 'https://nextjs.org/docs/app/getting-started/server-and-client-components',
        code: [
          {
            lang: 'tsx',
            code: `// Server Component (default): data is fetched and rendered to HTML on the server
export default async function Page() {
  const post = await getPost()
  return <article><h1>{post.title}</h1>{post.body}</article>
}`,
          },
        ],
      },
      react: {
        note: 'A plain Vite/CRA app is client-only. Move to a framework with SSR/SSG (Next.js, Remix/React Router) or add a prerender step (e.g. `vite-plugin-ssg`) so pages ship real HTML.',
        code: [
          {
            lang: 'bash',
            code: `# add build-time prerendering to a Vite React app
npm i -D vite-react-ssg`,
          },
        ],
      },
      vue: {
        note: 'Use Nuxt (SSR or `nuxi generate` for static) so pages render to HTML. A plain Vite Vue SPA is client-only and invisible to non-JS crawlers.',
        docsUrl: 'https://nuxt.com/docs/getting-started/deployment',
        code: [
          {
            lang: 'bash',
            code: `npx nuxi generate   # prerender all routes to static HTML`,
          },
        ],
      },
      svelte: {
        note: 'SvelteKit server-renders by default; keep pages using load functions and avoid `export const ssr = false`. Use `prerender = true` for fully static pages.',
        docsUrl: 'https://svelte.dev/docs/kit/page-options',
        code: [
          {
            lang: 'ts',
            caption: '+page.ts',
            code: `export const prerender = true // emit static HTML at build`,
          },
        ],
      },
      vanilla: {
        note: 'Render the HTML on the server (any templating layer) or generate static HTML files at build. Don’t rely on client JS to inject the primary content.',
        code: [
          {
            lang: 'html',
            code: `<!-- server-rendered: the content is already in the HTML -->
<main><h1>Real title</h1><p>Real content, present before any JS runs.</p></main>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Doesn’t Google run JavaScript now?',
        a: '`Googlebot` does render JS, but on a delay and with a budget, and many other crawlers and AI answer engines do not render at all. Server-rendered HTML is read immediately and universally — you shouldn’t rely on client rendering for content you want indexed and cited.',
      },
      {
        q: 'Is a `noscript` fallback enough?',
        a: 'A meaningful `<noscript>` block is better than nothing, but SSR/SSG is far more robust because it gives every consumer the full content. Treat `noscript` as a stopgap, not the fix.',
      },
      {
        q: 'How does VibeCheck detect this?',
        a: 'It re-fetches your page’s own URL and measures the text in the raw HTML the server returned. Under ~200 characters of body text means the content is being built client-side.',
      },
    ],
    related: ['missing-structured-data', 'missing-markdown-negotiation', 'missing-meta-description', 'large-javascript-bundles'],
  },
]
