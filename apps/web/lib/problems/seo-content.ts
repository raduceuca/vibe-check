import type { Problem } from './types'

// ── SEO problems: on-page content & markup (seo detector) ────────────────────
// Heading structure, alt text, link text, URL slugs, and indexability from
// packages/core/src/detectors/seo.ts. These are markup-level fixes: agents
// generate divs and generic labels, ship multiple <h1>s per component, and leave
// staging noindex tags in production.

export const seoContentProblems: readonly Problem[] = [
  {
    slug: 'missing-h1-heading',
    category: 'seo',
    detector: 'seo',
    checkId: 'h1-missing',
    severity: 'warning',
    title: 'Fix a missing H1 heading',
    metaDescription:
      'The <h1> is your page’s strongest on-page topic signal. If it is missing, add exactly one that names what the page is about.',
    h1: 'No H1 heading',
    pain: 'The `<h1>` is the strongest on-page signal of what a page is about, for both search engines and screen-reader users navigating by heading. AI-built pages often style a big `<div>` or `<p>` to look like a heading, so it looks right but carries zero semantic weight. Others start the document at `<h2>` because the `<h1>` “felt too big”.',
    symptoms: [
      'The visually-largest text is a styled `<div>` or `<span>`, not an `<h1>`',
      'The document heading outline starts at `<h2>`',
      'Screen-reader heading navigation skips the main topic',
    ],
    detection: {
      detector: 'seo',
      issueString: 'No <h1> heading',
      threshold: 'zero <h1> elements on the page',
    },
    rootCauses: [
      'A heading was faked with a styled div/span instead of a real `<h1>`',
      'The page starts its heading hierarchy at `<h2>`',
      'A shared layout owns the `<h1>` on some routes but not this one',
    ],
    fix: {
      summary:
        'Add exactly one `<h1>` per page that describes its main topic, and style it however you like — semantics and visual size are independent. Keep the rest of the outline logical (`<h2>` for sections, `<h3>` for subsections).',
      steps: [
        'Identify the page’s single main topic',
        'Mark it up as one `<h1>` (restyle with CSS, not by changing the tag)',
        'Ensure sub-sections use `<h2>`/`<h3>` in order',
      ],
      code: [
        {
          lang: 'html',
          code: `<!-- fake heading -->
<div class="text-4xl font-bold">Pricing</div>

<!-- real heading -->
<h1 class="text-4xl font-bold">Pricing</h1>`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Use a semantic `<h1>` element and style it with a class — do not reach for a styled div. Next.js is identical.',
        code: [
          {
            lang: 'tsx',
            code: `<h1 className="text-4xl font-bold">Pricing</h1>`,
          },
        ],
      },
      vue: {
        note: 'Render a real `<h1>` in the template.',
        code: [
          {
            lang: 'vue',
            code: `<template>
  <h1 class="text-4xl font-bold">Pricing</h1>
</template>`,
          },
        ],
      },
      svelte: {
        note: 'Use an `<h1>` element in your markup.',
        code: [
          {
            lang: 'svelte',
            code: `<h1 class="text-4xl font-bold">Pricing</h1>`,
          },
        ],
      },
      vanilla: {
        note: 'Ensure the page has one real `<h1>` element for its main topic.',
        code: [
          {
            lang: 'html',
            code: `<h1>Pricing</h1>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Can I have more than one H1?',
        a: 'HTML5 technically allows it, but for SEO clarity ship exactly one `<h1>` per page and use `<h2>`+ for the rest. Multiple `<h1>`s dilute the topic signal.',
      },
      {
        q: 'Does the H1 have to be the biggest text?',
        a: 'No. Semantics and styling are separate — style your `<h1>` however you like. What matters is that the tag is an `<h1>`.',
      },
      {
        q: 'Should the H1 match the <title>?',
        a: 'They should be closely related but need not be identical. The `<title>` is tuned for search results; the `<h1>` is the on-page headline.',
      },
    ],
    related: ['multiple-h1-headings', 'missing-page-title', 'missing-image-alt-text', 'missing-main-landmark'],
  },

  {
    slug: 'multiple-h1-headings',
    category: 'seo',
    detector: 'seo',
    checkId: 'h1-multiple',
    severity: 'info',
    title: 'Fix multiple H1 headings on a page',
    metaDescription:
      'Several <h1>s scatter your page’s topic signal. Keep one <h1> and demote the rest to <h2> so the outline is clear.',
    h1: 'Multiple H1 headings',
    pain: 'When several components each render their own `<h1>`, a page ends up with three or four competing “main topics”, and search engines have to guess which one describes the page. It also breaks the heading outline that screen-reader users rely on. Component libraries and AI-generated sections are the usual culprits — each card or hero brings its own `<h1>`.',
    symptoms: [
      'Multiple `<h1>` elements across cards, heroes, or sections',
      'The heading outline has several top-level entries',
      'Reused components each declare their own `<h1>`',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Multiple <h1> headings',
      threshold: 'more than one <h1> element',
    },
    rootCauses: [
      'Reusable section/card components each hard-code an `<h1>`',
      'A page composes several “hero” blocks that each own an `<h1>`',
      'Heading level was chosen for size, not hierarchy',
    ],
    fix: {
      summary:
        'Keep a single `<h1>` for the page’s main topic and demote every other to `<h2>` or lower based on its place in the outline. Make reusable components accept a heading level (or default to `<h2>`) so they never emit a second `<h1>`.',
      steps: [
        'Find every `<h1>` on the page',
        'Keep the one that names the page; change the rest to `<h2>`/`<h3>`',
        'Parameterise shared components so they do not hard-code `<h1>`',
      ],
      code: [
        {
          lang: 'html',
          code: `<h1>Product overview</h1>
<section>
  <h2>Pricing</h2>   <!-- was <h1> -->
</section>
<section>
  <h2>Features</h2>  <!-- was <h1> -->
</section>`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Give reusable section components a level prop so only the page owns the `<h1>`. Next.js is identical.',
        code: [
          {
            lang: 'tsx',
            code: `function Section({ as: Tag = 'h2', title }: { as?: 'h1' | 'h2' | 'h3'; title: string }) {
  return <Tag>{title}</Tag>
}
// page renders <h1> once; sections default to <h2>`,
          },
        ],
      },
      vue: {
        note: 'Use a dynamic component so the heading level is a prop, defaulting to h2.',
        code: [
          {
            lang: 'vue',
            code: `<template>
  <component :is="as">{{ title }}</component>
</template>

<script setup lang="ts">
defineProps<{ as?: 'h1' | 'h2' | 'h3'; title: string }>()
</script>`,
          },
        ],
      },
      svelte: {
        note: 'Use `svelte:element` so the tag is data-driven, defaulting to h2.',
        code: [
          {
            lang: 'svelte',
            code: `<script>
  export let as = 'h2'
  export let title
</script>

<svelte:element this={as}>{title}</svelte:element>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is multiple H1 actually penalised?',
        a: 'There is no direct penalty, but it weakens the topic signal and hurts accessibility. Keeping one `<h1>` is a clear, low-cost best practice.',
      },
      {
        q: 'What about the HTML5 outline algorithm?',
        a: 'The sectioning-based outline algorithm was never implemented by browsers or assistive tech. In practice, use a single `<h1>` and ordered `<h2>`+ headings.',
      },
    ],
    related: ['missing-h1-heading', 'missing-main-landmark', 'missing-page-title', 'missing-image-alt-text'],
  },

  {
    slug: 'missing-image-alt-text',
    category: 'seo',
    detector: 'seo',
    checkId: 'image-alt-missing',
    severity: 'warning',
    title: 'Fix images missing alt text',
    metaDescription:
      'Images with no alt attribute are invisible to screen readers and search engines. Add descriptive alt text (or alt="" if decorative).',
    h1: 'Images missing alt text',
    pain: 'The `alt` attribute is how screen-reader users perceive an image and how search engines (and image search) understand it. An `<img>` with no `alt` attribute is opaque to both — the user hears only “image” or the filename. AI-generated markup frequently emits `<img>` tags with a `src` and nothing else.',
    symptoms: [
      'Screen readers announce the filename or just “image”',
      'Images never appear in Google Image search',
      'axe/Lighthouse report “Image elements do not have [alt] attributes”',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Images missing alt text',
      threshold: 'one or more <img> without an alt attribute',
    },
    rootCauses: [
      'Generated `<img>` tags include `src` but no `alt`',
      'Dynamic images render without threading through an `alt` value',
      'Decorative images omit `alt` entirely instead of using `alt=""`',
    ],
    fix: {
      summary:
        'Give every `<img>` an `alt` attribute. For meaningful images, describe what the image conveys in context. For purely decorative images, use an explicit empty `alt=""` so assistive tech skips them — that is a valid signal, unlike a missing attribute.',
      steps: [
        'Add a descriptive `alt` to every content image',
        'Use `alt=""` for decorative images (not a missing attribute)',
        'For dynamic images, require `alt` text at the data layer',
      ],
      code: [
        {
          lang: 'html',
          code: `<!-- meaningful -->
<img src="/chart.png" alt="Revenue grew 40% from Q1 to Q2" />

<!-- decorative -->
<img src="/divider.svg" alt="" />`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'JSX warns on `<img>` without `alt` when the `jsx-a11y` ESLint rule is on. Thread `alt` through from data. Next.js `<Image>` requires it too.',
        code: [
          {
            lang: 'tsx',
            code: `<img src={photo.url} alt={photo.caption} />
// decorative:
<img src="/divider.svg" alt="" />`,
          },
        ],
      },
      vue: {
        note: 'Bind `alt` in the template; enable `vuejs-accessibility/alt-text` to catch omissions.',
        code: [
          {
            lang: 'vue',
            code: `<img :src="photo.url" :alt="photo.caption" />`,
          },
        ],
      },
      svelte: {
        note: 'Svelte’s compiler emits an `a11y-missing-attribute` warning for `<img>` without `alt`.',
        code: [
          {
            lang: 'svelte',
            code: `<img src={photo.url} alt={photo.caption} />`,
          },
        ],
      },
      vanilla: {
        note: 'Add an `alt` attribute to every `<img>` in your markup or templating.',
        code: [
          {
            lang: 'html',
            code: `<img src="/chart.png" alt="Revenue grew 40% from Q1 to Q2" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is `alt=""` ever correct?',
        a: 'Yes — for purely decorative images (dividers, background flourishes), an explicit empty `alt=""` tells assistive tech to skip it. That is different from omitting the attribute, which VibeCheck flags.',
      },
      {
        q: 'What makes good alt text?',
        a: 'Describe the information the image conveys in context, concisely. Skip “image of” — screen readers already announce it is an image.',
      },
      {
        q: 'Does alt text help SEO?',
        a: 'Yes. It helps images rank in image search and adds relevant context to the page. It is also a legal accessibility requirement in many jurisdictions.',
      },
    ],
    related: ['missing-h1-heading', 'unoptimized-images', 'large-image-files', 'missing-main-landmark'],
  },

  {
    slug: 'generic-link-text',
    category: 'seo',
    detector: 'seo',
    checkId: 'generic-link-text',
    severity: 'info',
    title: 'Fix vague link text (click here, read more)',
    metaDescription:
      'Links that say “click here” or “read more” tell search engines and screen readers nothing. Use text that names the destination.',
    h1: 'Vague link text',
    pain: 'Link text like “click here”, “read more”, or “learn more” carries no meaning on its own. Search engines use anchor text to understand the linked page, and screen-reader users often pull up a list of links out of context — a list of ten “read more” links is useless. AI-generated CTAs default to these generic phrases.',
    symptoms: [
      'Multiple links reading “click here”, “read more”, “learn more”',
      'A screen reader’s link list is full of identical, meaningless labels',
      'Anchor text gives search engines no signal about the destination',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Vague link text',
      threshold: 'link text matching /click here|read more|learn more|here|more|link|this/i',
    },
    rootCauses: [
      'CTA components default to generic labels',
      '“Read more” links after truncated cards reuse one phrase',
      'Link text was written for layout, not meaning',
    ],
    fix: {
      summary:
        'Write link text that describes the destination, so it makes sense read on its own. If a card’s layout needs a short CTA, add a visually-hidden label or an `aria-label` that names the target.',
      steps: [
        'Rewrite generic links to name their destination',
        'For unavoidable short CTAs, add an `aria-label` or visually-hidden text',
        'Verify each link makes sense out of context',
      ],
      code: [
        {
          lang: 'html',
          code: `<!-- vague -->
<a href="/pricing">Read more</a>

<!-- descriptive -->
<a href="/pricing">See pricing &amp; plans</a>

<!-- short CTA that still names the target -->
<a href="/pricing" aria-label="See pricing and plans">Read more</a>`,
        },
      ],
    },
    frameworkFixes: {
      react: {
        note: 'Pass a descriptive label, or an `aria-label` when the visible text must stay short. Next.js `<Link>` is identical.',
        code: [
          {
            lang: 'tsx',
            code: `<Link href="/pricing" aria-label="See pricing and plans">Read more</Link>`,
          },
        ],
      },
      vue: {
        note: 'Use descriptive slot text or bind `aria-label`.',
        code: [
          {
            lang: 'vue',
            code: `<router-link to="/pricing" aria-label="See pricing and plans">Read more</router-link>`,
          },
        ],
      },
      svelte: {
        note: 'Write descriptive anchor text, or add `aria-label` for short CTAs.',
        code: [
          {
            lang: 'svelte',
            code: `<a href="/pricing" aria-label="See pricing and plans">Read more</a>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Is “click here” really that bad?',
        a: 'For usability and SEO, yes. Anchor text describes the destination to crawlers and to screen-reader users reading a link list. “See pricing” beats “click here” every time.',
      },
      {
        q: 'How do I keep a short button label but still be descriptive?',
        a: 'Add an `aria-label` that names the destination, or include visually-hidden text. The visible label can stay short while assistive tech and crawlers get the full meaning.',
      },
    ],
    related: ['missing-image-alt-text', 'missing-h1-heading', 'missing-main-landmark', 'unfriendly-url-slug'],
  },

  {
    slug: 'unfriendly-url-slug',
    category: 'seo',
    detector: 'seo',
    checkId: 'slug-unfriendly',
    severity: 'info',
    title: 'Fix an unfriendly URL slug',
    metaDescription:
      'URLs with IDs, underscores, or capital letters are hard to read, share, and rank. Use clean, lowercase, hyphenated keyword slugs.',
    h1: 'Unfriendly URL slug',
    pain: 'A URL like /Blog_Post_00f3a2b1 is hard to read, hard to share, and gives search engines no keyword signal. Clean, human-readable slugs get more clicks when the URL shows in results and are easier to link to. AI-built apps frequently route by database ID or UUID and keep underscores or camelCase from variable names.',
    symptoms: [
      'URLs contain UUIDs or numeric IDs',
      'Slugs use underscores or capital letters instead of hyphens',
      'The address bar shows an unshareable, meaningless path',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Unfriendly URL slug',
      threshold: 'path contains a UUID, underscore, or capital letters',
    },
    rootCauses: [
      'Routes are keyed by database ID or UUID',
      'Slugs were derived from variable names (underscores, camelCase)',
      'No slugify step converts titles into clean paths',
    ],
    fix: {
      summary:
        'Use lowercase, hyphen-separated slugs made of real words — /blog/scaling-postgres, not /Blog_Post_00f3a2b1. Generate slugs from titles with a slugify step, and if you must keep an ID, pair it with a readable slug and 301-redirect the bare-ID form.',
      steps: [
        'Add a slugify step that lowercases and hyphenates titles',
        'Route by the clean slug (optionally slug + id)',
        '301-redirect old ID/underscore URLs to the new slug',
      ],
      code: [
        {
          lang: 'js',
          code: `const slugify = (s) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

slugify('Scaling Postgres to 1M rows') // → "scaling-postgres-to-1m-rows"`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Folder and dynamic-segment names become the URL. Name the `[slug]` segment from a clean slug field, not an id.',
        code: [
          {
            lang: 'bash',
            caption: 'Route by slug, not id',
            code: `app/blog/[slug]/page.tsx      # /blog/scaling-postgres  ✅
app/blog/[id]/page.tsx        # /blog/00f3a2b1          ❌`,
          },
        ],
      },
      vanilla: {
        note: 'Generate clean slugs when creating content and map them to your routes; redirect legacy ID URLs.',
        code: [
          {
            lang: 'js',
            code: `// store a slug alongside the id, route on the slug
router.get('/blog/:slug', handler)`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Hyphens or underscores in URLs?',
        a: 'Hyphens. Google treats hyphens as word separators but underscores as joiners, so “scaling_postgres” reads as one token while “scaling-postgres” reads as two words.',
      },
      {
        q: 'Can I keep the database ID in the URL?',
        a: 'You can pair it with a readable slug (/blog/scaling-postgres-42), but a bare ID or UUID is unfriendly. If you change the scheme, 301-redirect the old URLs.',
      },
    ],
    related: ['missing-canonical-url', 'missing-og-url', 'missing-page-title', 'missing-sitemap'],
  },

  {
    slug: 'accidental-noindex',
    category: 'seo',
    detector: 'seo',
    checkId: 'noindex',
    severity: 'error',
    title: 'Fix an accidental noindex tag',
    metaDescription:
      'A noindex tag tells search engines to drop the page from results entirely. If it is not deliberate — often a staging leftover — remove it.',
    h1: 'Page is set to “noindex”',
    pain: 'A `<meta name="robots" content="noindex">` tells search engines to leave the page out of results entirely — the single most damaging SEO mistake because the page simply disappears. It is very often a leftover from a staging or “coming soon” environment that shipped to production. If it is not deliberate, it is an emergency.',
    symptoms: [
      'The page vanished from Google after a deploy',
      'Search Console reports “Excluded by ‘noindex’ tag”',
      'A staging-wide `noindex` made it into the production build',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Page is set to "noindex"',
      threshold: '<meta name="robots" content> includes \'noindex\'',
    },
    rootCauses: [
      'A staging/preview environment’s global `noindex` shipped to production',
      'An environment flag that toggles `noindex` is misconfigured in prod',
      'A CMS “hidden” toggle was left on for a live page',
    ],
    fix: {
      summary:
        'Remove the `noindex` directive from any page that should be indexed. If you gate indexing by environment, make sure production never emits `noindex` — and double-check the header form (`X-Robots-Tag`) too, not just the meta tag.',
      steps: [
        'Search the codebase for “noindex” (meta tag and `X-Robots-Tag` header)',
        'Ensure production never emits it; gate it strictly to non-prod',
        'Request re-indexing in Search Console once removed',
      ],
      code: [
        {
          lang: 'html',
          code: `<!-- remove this on any page that should rank -->
<meta name="robots" content="noindex" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Control indexing via the metadata `robots` field, gated by environment so production always indexes.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata#robots',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  robots: { index: process.env.VERCEL_ENV === 'production', follow: true },
}`,
          },
        ],
      },
      react: {
        note: 'Only render the robots meta tag in non-production environments.',
        code: [
          {
            lang: 'tsx',
            code: `{import.meta.env.PROD ? null : <meta name="robots" content="noindex" />}`,
          },
        ],
      },
      svelte: {
        note: 'Guard the `noindex` tag by environment inside `<svelte:head>`.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  {#if !import.meta.env.PROD}
    <meta name="robots" content="noindex" />
  {/if}
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Only inject the `noindex` tag (or `X-Robots-Tag` header) in staging; strip it from production builds.',
        code: [
          {
            lang: 'html',
            code: `<!-- staging only; must not ship to production -->
<meta name="robots" content="noindex" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'How fast will my page come back after removing `noindex`?',
        a: 'It returns on the next crawl, which can be hours to weeks. Request indexing in Google Search Console to speed it up once the tag is gone.',
      },
      {
        q: 'Is there a header version of `noindex` I might be missing?',
        a: 'Yes — the `X-Robots-Tag` HTTP header does the same thing and is easy to overlook. Check your server/CDN config as well as the meta tag.',
      },
      {
        q: 'What is the correct tag for pages I do want indexed?',
        a: 'You do not need any robots tag for the default indexable behaviour. Only add a robots meta when you specifically want to restrict indexing.',
      },
    ],
    related: ['missing-canonical-url', 'missing-robots-txt', 'missing-sitemap', 'ai-crawlers-blocked'],
  },
]
