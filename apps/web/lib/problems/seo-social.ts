import type { Problem } from './types'

// ── SEO problems: Open Graph, Twitter/X cards, canonical (seo detector) ──────
// Share-preview and duplicate-URL checks from packages/core/src/detectors/
// seo.ts. Agents duplicate routes (trailing slash, query params, /amp) and never
// emit og:* or canonical, so links look blank when shared and ranking fragments.

export const seoSocialProblems: readonly Problem[] = [
  {
    slug: 'missing-og-image',
    category: 'seo',
    detector: 'seo',
    checkId: 'og-image-missing',
    severity: 'warning',
    title: 'Fix a missing og:image social preview',
    metaDescription:
      'With no og:image, links to your page show a blank box on Slack, X, and iMessage. Add a 1200×630 preview image so shares look real.',
    h1: 'Missing social preview image (og:image)',
    pain: 'When your page is shared on Slack, X, LinkedIn, or iMessage, the platform reads <meta property="og:image"> to draw the preview card. With none, the link renders as a bare, blank box — a preview that says “this looks broken”. AI-built pages almost never generate an OG image because it is an asset plus a head tag, not component code.',
    symptoms: [
      'Shared links show an empty or generic grey preview',
      'Slack/Discord unfurls have no thumbnail',
      'Link previews look unfinished next to competitors’ rich cards',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing social preview image (og:image)',
      threshold: 'no <meta property="og:image">',
    },
    rootCauses: [
      'No OG image asset was ever created',
      'The <head> is unmanaged so no og:* tags are emitted',
      'Only og:title was set, leaving the image out',
    ],
    fix: {
      summary:
        'Add an og:image pointing to a 1200×630 PNG or JPG at an absolute URL (crawlers do not resolve relative paths). Include og:image:width/height so platforms can lay out the card before the image loads.',
      steps: [
        'Create a 1200×630 preview image (or generate one per route)',
        'Host it at an absolute URL',
        'Add og:image plus width/height meta tags in <head>',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta property="og:image" content="https://acme.com/og/pricing.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set images in the metadata `openGraph` object, or generate them dynamically with the built-in ImageResponse in an opengraph-image.tsx file — Next wires up the tags and dimensions.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata#opengraph',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  openGraph: {
    images: [{ url: 'https://acme.com/og/pricing.png', width: 1200, height: 630 }],
  },
}`,
          },
        ],
      },
      react: {
        note: 'Render the og:image meta tags in the component (React 19), using an absolute URL.',
        code: [
          {
            lang: 'tsx',
            code: `<meta property="og:image" content="https://acme.com/og/pricing.png" />`,
          },
        ],
      },
      vue: {
        note: 'Add the og:image entries to useHead’s meta array with `property` keys.',
        code: [
          {
            lang: 'ts',
            code: `useHead({
  meta: [{ property: 'og:image', content: 'https://acme.com/og/pricing.png' }],
})`,
          },
        ],
      },
      svelte: {
        note: 'Emit the og:image tag inside <svelte:head>.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <meta property="og:image" content="https://acme.com/og/pricing.png" />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the og:image tags to each page’s <head> with an absolute URL.',
        code: [
          {
            lang: 'html',
            code: `<meta property="og:image" content="https://acme.com/og/pricing.png" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What size should the og:image be?',
        a: '1200×630 pixels (1.91:1) is the standard that renders well everywhere. Keep it under ~1MB and use PNG or JPG.',
      },
      {
        q: 'Can I use a relative image URL?',
        a: 'No. Crawlers fetch og:image from an absolute URL. A relative path resolves against the crawler, not your site, and fails.',
      },
      {
        q: 'Why is my new image not showing when I share?',
        a: 'Platforms cache unfurls aggressively. Use the platform’s debugger (e.g. the Facebook Sharing Debugger or X Card Validator) to force a re-scrape.',
      },
    ],
    related: ['missing-og-title', 'missing-og-description', 'missing-twitter-card', 'missing-meta-description'],
  },

  {
    slug: 'missing-og-title',
    category: 'seo',
    detector: 'seo',
    checkId: 'og-title-missing',
    severity: 'info',
    title: 'Fix a missing og:title',
    metaDescription:
      'Without og:title, shared links fall back to your raw <title>, which may not be share-optimised. Set an explicit og:title.',
    h1: 'Missing og:title',
    pain: 'og:title is the bold headline on a shared link card. When it is absent, platforms fall back to the page <title> — which is tuned for search results, not for a social card, and sometimes carries a long brand suffix that gets cut. Setting it explicitly lets you write copy that fits the card.',
    symptoms: [
      'Share cards reuse the SEO title, brand suffix and all',
      'Headlines on social cards read awkwardly or get truncated',
      'No independent control over the share headline',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing og:title',
      threshold: 'no <meta property="og:title">',
    },
    rootCauses: [
      'Only the <title> was set; og:* was skipped',
      'The head is unmanaged',
      'Assumed the platform would “figure it out”',
    ],
    fix: {
      summary:
        'Add og:title with a short, punchy headline written for a social card (roughly under 60 characters, no long brand suffix). It can differ from your <title>.',
      steps: [
        'Write a short share-optimised headline',
        'Emit it as <meta property="og:title">',
        'Preview the card in a share debugger',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta property="og:title" content="Invoicing that pays you faster" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set `openGraph.title` in metadata; it defaults to your title if omitted, so set it only when you want different copy.',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  openGraph: { title: 'Invoicing that pays you faster' },
}`,
          },
        ],
      },
      react: {
        note: 'Render the og:title meta tag in the component (React 19).',
        code: [
          {
            lang: 'tsx',
            code: `<meta property="og:title" content="Invoicing that pays you faster" />`,
          },
        ],
      },
      vue: {
        note: 'Add it to useHead with a `property` key.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ meta: [{ property: 'og:title', content: 'Invoicing that pays you faster' }] })`,
          },
        ],
      },
      svelte: {
        note: 'Emit it in <svelte:head>.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <meta property="og:title" content="Invoicing that pays you faster" />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the og:title tag to each page’s <head>. It can differ from the <title>, so write it for the share card.',
        code: [
          {
            lang: 'html',
            code: `<meta property="og:title" content="Invoicing that pays you faster" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is og:title required if I already have a <title>?',
        a: 'Platforms fall back to <title>, so it is not strictly required — but setting og:title lets you write card-specific copy and avoid a truncated brand suffix.',
      },
      {
        q: 'How long can og:title be?',
        a: 'Keep it under ~60 characters. Cards truncate long titles, and a short punchy headline performs better.',
      },
      {
        q: 'Should og:title include my brand name?',
        a: 'On a share card, usually not. The card already shows the domain, so a bare “Invoicing that pays you faster” reads cleaner than “… | Acme”. Keep the brand suffix in your <title>, where the search result benefits from it.',
      },
    ],
    related: ['missing-og-image', 'missing-og-description', 'missing-twitter-card', 'missing-page-title'],
  },

  {
    slug: 'missing-og-description',
    category: 'seo',
    detector: 'seo',
    checkId: 'og-description-missing',
    severity: 'info',
    title: 'Fix a missing og:description',
    metaDescription:
      'With no og:description, shared links show no supporting text under the title. Add one to make link previews compelling.',
    h1: 'Missing og:description',
    pain: 'og:description is the supporting line under the headline on a share card. Without it, the card is just a title and image, or the platform guesses from page text. A tuned description makes the difference between a card that gets clicked and one that gets scrolled past.',
    symptoms: [
      'Share cards show only a title and image, no supporting copy',
      'Platforms auto-fill descriptions with random page text',
      'No control over the sentence that supports the share headline',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing og:description',
      threshold: 'no <meta property="og:description">',
    },
    rootCauses: [
      'og:image and og:title were set, but the description was left out',
      'The <head> is unmanaged, so no og:* tags are emitted',
      'Assumed og:description falls back to <meta name="description"> — it does not, reliably',
    ],
    fix: {
      summary:
        'Add og:description with a concise, benefit-led sentence (roughly under 110 characters for full display on most cards). It can mirror or improve on your meta description.',
      steps: [
        'Write a short supporting sentence for the card',
        'Emit it as <meta property="og:description">',
        'Preview the unfurl before publishing',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta property="og:description" content="Send branded invoices in a minute and get paid faster." />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set `openGraph.description` in metadata.',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  openGraph: { description: 'Send branded invoices in a minute and get paid faster.' },
}`,
          },
        ],
      },
      react: {
        note: 'Render the og:description meta tag (React 19).',
        code: [
          {
            lang: 'tsx',
            code: `<meta property="og:description" content="Send branded invoices in a minute and get paid faster." />`,
          },
        ],
      },
      vue: {
        note: 'Add it to useHead with a `property` key.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ meta: [{ property: 'og:description', content: 'Send branded invoices in a minute.' }] })`,
          },
        ],
      },
      svelte: {
        note: 'Emit it inside <svelte:head>.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <meta property="og:description" content="Send branded invoices in a minute." />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the og:description tag to each page’s <head>. Keep it in sync with your meta description, but write it for the card, not the search result.',
        code: [
          {
            lang: 'html',
            code: `<meta property="og:description" content="Send branded invoices in a minute and get paid faster." />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Does og:description reuse my meta description?',
        a: 'Some platforms fall back to it, but not reliably. Set og:description explicitly so the card copy is always intentional.',
      },
      {
        q: 'How long should og:description be?',
        a: 'Keep it under ~110 characters so it displays in full on most cards; longer text gets truncated.',
      },
      {
        q: 'Should og:description differ from my meta description?',
        a: 'It can. The meta description is written to earn a click in a search result; og:description supports a share headline that already has an image and a title. Reuse the meta description if it fits, but tightening it for the card usually reads better.',
      },
      {
        q: 'The description does not update when I re-share — why?',
        a: 'Platforms cache unfurls. Force a re-scrape with the platform’s share debugger (for example the Facebook Sharing Debugger) after you change the tag.',
      },
    ],
    related: ['missing-og-title', 'missing-og-image', 'missing-meta-description', 'missing-twitter-card'],
  },

  {
    slug: 'missing-og-url',
    category: 'seo',
    detector: 'seo',
    checkId: 'og-url-missing',
    severity: 'info',
    title: 'Fix a missing og:url',
    metaDescription:
      'og:url tells platforms the canonical address to credit shares to, even with tracking params. Set it so shares consolidate.',
    h1: 'Missing og:url',
    pain: 'og:url tells social platforms which canonical address a share belongs to, so likes and shares of the same page via different tracking links consolidate onto one URL. Without it, a page shared with ?utm_source=… can be treated as a separate object, splitting its social signals.',
    symptoms: [
      'The same page shared with different query params counts as separate shares',
      'Share counts and engagement fragment across tracking URLs',
      'Platforms echo the messy tracking URL instead of the clean one',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing og:url',
      threshold: 'no <meta property="og:url">',
    },
    rootCauses: [
      'og:* tags were partially implemented — image and title landed, url did not',
      'No canonical URL strategy exists, so there is no clean URL to point at',
      'The <head> is unmanaged, so no og:* tags are emitted',
      'The page is reachable at several URLs (params, trailing slash) with none declared canonical',
    ],
    fix: {
      summary:
        'Add og:url with the page’s clean, absolute canonical URL — no tracking parameters. It should match your <link rel="canonical">.',
      steps: [
        'Determine the clean canonical URL for the page',
        'Emit it as <meta property="og:url">',
        'Keep it in sync with your canonical link',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta property="og:url" content="https://acme.com/pricing" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set `openGraph.url`; keep it identical to `alternates.canonical`.',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  openGraph: { url: 'https://acme.com/pricing' },
  alternates: { canonical: 'https://acme.com/pricing' },
}`,
          },
        ],
      },
      react: {
        note: 'Render the og:url tag with the absolute canonical URL (React 19).',
        code: [
          {
            lang: 'tsx',
            code: `<meta property="og:url" content="https://acme.com/pricing" />`,
          },
        ],
      },
      vue: {
        note: 'Add the og:url entry to useHead, building the absolute URL from the current route.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ meta: [{ property: 'og:url', content: 'https://acme.com/pricing' }] })`,
          },
        ],
      },
      svelte: {
        note: 'Emit it in <svelte:head>, matching your canonical link and building the URL from $page.url.',
        code: [
          {
            lang: 'svelte',
            code: `<script>
  import { page } from '$app/stores'
</script>

<svelte:head>
  <meta property="og:url" content={\`https://acme.com\${$page.url.pathname}\`} />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the og:url tag to each page’s <head> with the clean, absolute canonical URL — no tracking params.',
        code: [
          {
            lang: 'html',
            code: `<meta property="og:url" content="https://acme.com/pricing" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Should og:url match my canonical link?',
        a: 'Yes. Keep og:url identical to <link rel="canonical"> so social and search agree on the one true URL for the page.',
      },
      {
        q: 'Should og:url include tracking parameters?',
        a: 'No. Strip utm_* and other params so shares consolidate onto the clean URL.',
      },
      {
        q: 'What happens if og:url points at the wrong page?',
        a: 'Platforms credit the share — and its engagement — to whatever og:url says, and echo that URL in the card. A stale or wrong value sends clicks to the wrong page, so build it from the current route, not a hardcoded string.',
      },
      {
        q: 'Do I need og:url if I already set a canonical link?',
        a: 'They serve different consumers: <link rel="canonical"> is for search engines, og:url is for social platforms. Set both, and keep them identical.',
      },
    ],
    related: ['missing-canonical-url', 'missing-og-image', 'missing-og-title', 'unfriendly-url-slug'],
  },

  {
    slug: 'missing-twitter-card',
    category: 'seo',
    detector: 'seo',
    checkId: 'twitter-card-missing',
    severity: 'info',
    title: 'Fix a missing Twitter/X card',
    metaDescription:
      'Without twitter:card, links on X show a plain URL instead of a rich preview. Add summary_large_image for a full-width card.',
    h1: 'Missing Twitter/X card',
    pain: 'X (Twitter) reads twitter:card to decide how to render a shared link. Without it, your link may appear as bare text instead of a rich card with image and headline. While X often falls back to Open Graph tags, declaring the card type explicitly guarantees the large-image layout.',
    symptoms: [
      'Links on X render as plain text, no image',
      'The card uses a small thumbnail instead of the large image layout',
      'Preview differs from other platforms that read og:*',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing Twitter/X card',
      threshold: 'no <meta name="twitter:card">',
    },
    rootCauses: [
      'Only og:* tags were added; twitter:* was skipped',
      'No explicit card type declared, so the large-image layout is not guaranteed',
      'The head is unmanaged',
    ],
    fix: {
      summary:
        'Add twitter:card set to summary_large_image for a full-width preview. X reuses og:title, og:description, and og:image, so you usually only need the card type (plus optional twitter:site/creator handles).',
      steps: [
        'Add <meta name="twitter:card" content="summary_large_image">',
        'Ensure og:image/title/description are present (X reuses them)',
        'Validate the card in X’s card preview tooling',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@acme" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set the `twitter` object in metadata. Next reuses your OpenGraph image/title/description automatically.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata#twitter',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  twitter: { card: 'summary_large_image', site: '@acme' },
}`,
          },
        ],
      },
      react: {
        note: 'Render the twitter:card meta tag (React 19).',
        code: [
          {
            lang: 'tsx',
            code: `<meta name="twitter:card" content="summary_large_image" />`,
          },
        ],
      },
      vue: {
        note: 'Add it to useHead with a `name` key.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ meta: [{ name: 'twitter:card', content: 'summary_large_image' }] })`,
          },
        ],
      },
      svelte: {
        note: 'Emit it inside <svelte:head>.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the twitter:card tag to each page’s <head>. X reuses your og:image/title/description, so the card type is usually all you need.',
        code: [
          {
            lang: 'html',
            code: `<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@acme" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Do I need twitter:* tags if I already have og:* tags?',
        a: 'X falls back to og:* for image, title, and description, but you should still set twitter:card to guarantee the summary_large_image layout.',
      },
      {
        q: 'What card types exist?',
        a: 'The common ones are “summary” (small square thumbnail) and “summary_large_image” (full-width image). Use the latter for most content pages.',
      },
      {
        q: 'What are twitter:site and twitter:creator for?',
        a: 'They attribute the card to X handles — twitter:site to the publishing account, twitter:creator to the author. They are optional and don’t change the layout, but they add the “@handle” byline on the card.',
      },
      {
        q: 'My og:image is 1200×630 — does it work as a Twitter card?',
        a: 'Yes. summary_large_image uses the same 1200×630 (1.91:1) image as Open Graph, so one image covers both. X reads og:image when no separate twitter:image is set.',
      },
    ],
    related: ['missing-og-image', 'missing-og-title', 'missing-og-description', 'missing-meta-description'],
  },

  {
    slug: 'missing-canonical-url',
    category: 'seo',
    detector: 'seo',
    checkId: 'canonical-missing',
    severity: 'info',
    title: 'Fix a missing canonical URL',
    metaDescription:
      'Duplicate URLs (trailing slash, query params) split your ranking. Add <link rel="canonical"> to point search engines at one address.',
    h1: 'Missing canonical link',
    pain: 'The same content is often reachable at several URLs — with and without a trailing slash, with query or tracking params, at www and apex. Without <link rel="canonical">, search engines may treat these as separate pages and split ranking signals between them. AI-built apps generate lots of parameterised and duplicated routes, making this common.',
    symptoms: [
      'The same page indexed under multiple URLs',
      'Ranking signals split between ?utm and clean URLs',
      'www vs non-www or trailing-slash duplicates in Search Console',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing canonical link',
      threshold: 'no <link rel="canonical">',
    },
    rootCauses: [
      'Routes are reachable at multiple URL variants with no canonical declared',
      'Query and tracking parameters create infinite URL variants',
      'The head is unmanaged so no canonical tag is emitted',
    ],
    fix: {
      summary:
        'Add a <link rel="canonical"> whose href is the page’s single preferred absolute URL — clean, no tracking params, with a consistent trailing-slash and host convention. Self-reference it on the canonical page itself.',
      steps: [
        'Pick one canonical URL convention (host, trailing slash) and apply it everywhere',
        'Emit <link rel="canonical"> with the clean absolute URL on every page',
        'Point duplicate/parameterised variants at the same canonical',
      ],
      code: [
        {
          lang: 'html',
          code: `<link rel="canonical" href="https://acme.com/pricing" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set `alternates.canonical` in metadata. A relative path resolves against `metadataBase`, which you set once in the root layout.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata#alternates',
        code: [
          {
            lang: 'tsx',
            caption: 'app/layout.tsx sets metadataBase; pages set canonical',
            code: `// app/layout.tsx
export const metadata: Metadata = { metadataBase: new URL('https://acme.com') }

// app/pricing/page.tsx
export const metadata: Metadata = { alternates: { canonical: '/pricing' } }`,
          },
        ],
      },
      react: {
        note: 'Render <link rel="canonical"> with an absolute URL (React 19), or use react-helmet-async on React 18.',
        code: [
          {
            lang: 'tsx',
            code: `<link rel="canonical" href="https://acme.com/pricing" />`,
          },
        ],
      },
      vue: {
        note: 'Add a link entry to useHead.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ link: [{ rel: 'canonical', href: 'https://acme.com/pricing' }] })`,
          },
        ],
      },
      svelte: {
        note: 'Emit the canonical link in <svelte:head>, building the URL from $page.url.',
        code: [
          {
            lang: 'svelte',
            code: `<script>
  import { page } from '$app/stores'
</script>

<svelte:head>
  <link rel="canonical" href={\`https://acme.com\${$page.url.pathname}\`} />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the canonical link to each page’s <head> with the clean absolute URL.',
        code: [
          {
            lang: 'html',
            code: `<link rel="canonical" href="https://acme.com/pricing" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Should a page canonicalise to itself?',
        a: 'Yes. The preferred version should carry a self-referencing canonical. Duplicate variants then point at that same URL.',
      },
      {
        q: 'Does canonical fix duplicate content penalties?',
        a: 'There is no “penalty” per se, but canonical consolidates ranking signals onto one URL so duplicates do not compete with each other.',
      },
      {
        q: 'Absolute or relative canonical URL?',
        a: 'Use absolute URLs. They are unambiguous to crawlers. In Next.js a relative path is fine because metadataBase makes it absolute at build time.',
      },
    ],
    related: ['missing-og-url', 'unfriendly-url-slug', 'accidental-noindex', 'missing-page-title'],
  },
]
