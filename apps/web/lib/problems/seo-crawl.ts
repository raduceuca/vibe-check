import type { Problem } from './types'

// ── SEO problems: crawl infrastructure (seo detector, async probes) ──────────
// sitemap.xml and robots.txt checks from packages/core/src/detectors/seo.ts.
// These are async same-origin GET probes: a file is treated as missing unless it
// responds 2xx with the right content type (an SPA dev server returning
// index.html for /sitemap.xml is correctly read as "no real sitemap").

export const seoCrawlProblems: readonly Problem[] = [
  {
    slug: 'missing-sitemap',
    category: 'seo',
    detector: 'seo',
    checkId: 'sitemap-missing',
    severity: 'warning',
    title: 'Fix a missing or invalid sitemap.xml',
    metaDescription:
      'Without a sitemap, search engines discover pages the slow way. Generate a /sitemap.xml listing your URLs and reference it from robots.txt.',
    h1: 'Missing or invalid sitemap.xml',
    pain: 'A sitemap hands search engines a machine-readable list of your URLs plus last-modified dates, so they index new and updated pages faster and more completely. Without one, crawlers have to discover every page by following links, which misses orphaned pages and slows indexing. Client-rendered SPAs are hit hardest because there are few crawlable links to follow.',
    symptoms: [
      '`/sitemap.xml` returns a `404` or your SPA’s `index.html`',
      'New pages take a long time to appear in search',
      'Search Console reports no submitted sitemap',
      'Orphaned pages (no inbound links) never get indexed',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing or invalid sitemap.xml',
      threshold: '/sitemap.xml is not a 2xx XML response',
    },
    rootCauses: [
      'No sitemap is generated at build or request time',
      'The SPA dev server returns `index.html` for `/sitemap.xml`, so it is not real XML',
      'The sitemap exists but is not referenced from `robots.txt`',
    ],
    fix: {
      summary:
        'Generate a `/sitemap.xml` that lists every indexable URL with a `<loc>` and ideally a `<lastmod>`. Serve it with an XML content type, keep it under 50,000 URLs / 50MB per file (split with a sitemap index if larger), and reference it from `robots.txt`.',
      steps: [
        'Generate an XML sitemap of your indexable URLs at build or request time',
        'Serve it at `/sitemap.xml` with an `application/xml` content type',
        'Add a `Sitemap:` line to `robots.txt` and submit it in Search Console',
      ],
      code: [
        {
          lang: 'xml',
          caption: 'sitemap.xml',
          code: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://acme.com/</loc>
    <lastmod>2026-01-15</lastmod>
  </url>
  <url>
    <loc>https://acme.com/pricing</loc>
  </url>
</urlset>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Add `app/sitemap.ts` exporting a default function that returns a `MetadataRoute.Sitemap` array. Next serves it at `/sitemap.xml` with the right content type; make it dynamic to include data-driven routes.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap',
        code: [
          {
            lang: 'ts',
            caption: 'app/sitemap.ts',
            code: `import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://acme.com/', lastModified: new Date() },
    { url: 'https://acme.com/pricing' },
  ]
}`,
          },
        ],
      },
      svelte: {
        note: 'Create a SvelteKit endpoint that returns XML with the correct content type.',
        code: [
          {
            lang: 'ts',
            caption: 'src/routes/sitemap.xml/+server.ts',
            code: `export async function GET() {
  const urls = ['https://acme.com/', 'https://acme.com/pricing']
  const body = \`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
\${urls.map((u) => \`  <url><loc>\${u}</loc></url>\`).join('\\n')}
</urlset>\`
  return new Response(body, { headers: { 'Content-Type': 'application/xml' } })
}`,
          },
        ],
      },
      react: {
        note: 'A Vite SPA has no server, so generate the sitemap at build time (a script or a plugin like `vite-plugin-sitemap`) and emit it into the static output.',
        code: [
          {
            lang: 'bash',
            code: `npm i -D vite-plugin-sitemap
# configure it in vite.config.ts with your route list`,
          },
        ],
      },
      vanilla: {
        note: 'Write a static `sitemap.xml` into your public directory, or generate it in a build step.',
        code: [
          {
            lang: 'bash',
            code: `public/sitemap.xml   # served at /sitemap.xml`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Do small sites need a sitemap?',
        a: 'A well-linked small site can be crawled without one, but a sitemap still speeds up discovery of new and updated pages and is essential for SPAs with few crawlable links.',
      },
      {
        q: 'Why does VibeCheck flag my sitemap as invalid?',
        a: 'The probe treats `/sitemap.xml` as missing unless it responds 2xx with an XML content type. A SPA dev server returning `index.html` for unknown paths reads as “not a real sitemap”.',
      },
      {
        q: 'Should I reference the sitemap in `robots.txt`?',
        a: 'Yes. Add a “`Sitemap: https://acme.com/sitemap.xml`” line to `robots.txt` so crawlers find it even before you submit it in Search Console.',
      },
    ],
    related: ['missing-robots-txt', 'unfriendly-url-slug', 'content-requires-javascript', 'missing-canonical-url'],
  },

  {
    slug: 'missing-robots-txt',
    category: 'seo',
    detector: 'seo',
    checkId: 'robots-missing',
    severity: 'info',
    title: 'Fix a missing robots.txt',
    metaDescription:
      'A robots.txt tells crawlers what to index and where your sitemap is. Add one so crawling is intentional, not guessed.',
    h1: 'Missing robots.txt',
    pain: '`robots.txt` is the first file most crawlers request. It lets you allow or disallow paths and — importantly — point crawlers at your sitemap. It is optional but recommended: without it, crawling is left to defaults, and you lose an easy place to advertise your sitemap and manage crawl access.',
    symptoms: [
      '`/robots.txt` returns a `404`',
      'No place to point crawlers at your sitemap',
      'No control over which paths crawlers should skip',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing robots.txt',
      threshold: '/robots.txt is not a 2xx text/plain response',
    },
    rootCauses: [
      'No `robots.txt` was ever added to the project',
      'The SPA returns `index.html` for `/robots.txt` instead of plain text',
      'The file exists but is served with the wrong content type',
    ],
    fix: {
      summary:
        'Add a `/robots.txt` served as `text/plain`. For most sites, allow all crawling and reference your sitemap. Only disallow paths you genuinely want kept out of the index (and remember `robots.txt` does not make a page private — it only requests crawlers skip it).',
      steps: [
        'Create a `robots.txt` that allows crawling and lists your sitemap',
        'Serve it at `/robots.txt` with a `text/plain` content type',
        'Disallow only paths you truly want uncrawled',
      ],
      code: [
        {
          lang: 'bash',
          caption: 'robots.txt',
          code: `User-agent: *
Allow: /

Sitemap: https://acme.com/sitemap.xml`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Add `app/robots.ts` exporting a default function returning a `MetadataRoute.Robots` object. Next serves it at `/robots.txt`.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots',
        code: [
          {
            lang: 'ts',
            caption: 'app/robots.ts',
            code: `import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: 'https://acme.com/sitemap.xml',
  }
}`,
          },
        ],
      },
      react: {
        note: 'A Vite SPA has no server, so a `robots.txt` is just a static file. Drop it in `public/` and Vite copies it to the build root, served at `/robots.txt` as `text/plain`.',
        code: [
          {
            lang: 'bash',
            code: `public/robots.txt   # served at /robots.txt`,
          },
        ],
      },
      vue: {
        note: 'In Nuxt, place `robots.txt` in the `public/` directory, or use the `@nuxtjs/robots` module to generate it from config. A plain Vite + Vue app is the same as React — a static file in `public/`.',
        docsUrl: 'https://nuxt.com/modules/robots',
        code: [
          {
            lang: 'bash',
            code: `public/robots.txt   # served at /robots.txt`,
          },
        ],
      },
      svelte: {
        note: 'Serve `robots.txt` from a SvelteKit endpoint (or place a static file in `static/`).',
        code: [
          {
            lang: 'ts',
            caption: 'src/routes/robots.txt/+server.ts',
            code: `export function GET() {
  const body = 'User-agent: *\\nAllow: /\\n\\nSitemap: https://acme.com/sitemap.xml\\n'
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } })
}`,
          },
        ],
      },
      vanilla: {
        note: 'Place a static `robots.txt` in your public directory so it is served at `/robots.txt`.',
        code: [
          {
            lang: 'bash',
            code: `public/robots.txt   # served at /robots.txt`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Does `robots.txt` make a page private?',
        a: 'No. It only requests that compliant crawlers skip a path. The page is still reachable by URL. To keep content private, use authentication; to keep it out of search, use `noindex`.',
      },
      {
        q: 'What is the minimum useful `robots.txt`?',
        a: 'Allow all crawling and point to your sitemap: “`User-agent: *`”, “`Allow: /`”, and a “`Sitemap:`” line. That is enough for most sites.',
      },
      {
        q: 'Can `robots.txt` block AI crawlers?',
        a: 'Yes — you can disallow specific AI user-agents. If you want to be cited by AI answer engines, do the opposite and allow them; VibeCheck’s AEO audit checks for that.',
      },
      {
        q: 'Why does VibeCheck flag `robots.txt` as missing when the file exists?',
        a: 'The probe treats `/robots.txt` as missing unless it responds 2xx with a `text/plain` content type. An SPA dev server that returns `index.html` for unknown paths reads as “not a real `robots.txt`” — serve it as plain text to clear the check.',
      },
      {
        q: 'Should I disallow anything by default?',
        a: 'No. Start with “`Allow: /`” and only disallow paths you genuinely want kept out of the index — a staging area, internal search results, or duplicate print views. Over-broad `Disallow` rules are a common way to accidentally de-index a whole site.',
      },
    ],
    related: ['missing-sitemap', 'ai-crawlers-blocked', 'accidental-noindex', 'missing-mcp-discovery'],
  },
]
