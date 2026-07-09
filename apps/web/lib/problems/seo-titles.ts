import type { Problem } from './types'

// ── SEO problems: titles & meta descriptions (seo detector) ──────────────────
// The <title> and <meta name="description"> checks from packages/core/src/
// detectors/seo.ts. AI agents own the component tree but rarely touch <head>, so
// they ship framework placeholder titles and no descriptions by default.

export const seoTitleProblems: readonly Problem[] = [
  {
    slug: 'missing-page-title',
    category: 'seo',
    detector: 'seo',
    checkId: 'title-missing',
    severity: 'warning',
    title: 'Fix a missing page title',
    metaDescription:
      'With no <title>, search results and browser tabs fall back to your URL. Add one unique, descriptive title under 60 characters.',
    h1: 'Missing page title',
    pain: 'The `<title>` is the single strongest on-page ranking signal and the clickable headline in every search result. With none, Google shows your raw URL and browser tabs show a fragment of the address. AI scaffolds generate the app body but leave the document `<head>` alone, so the title never gets set for real routes.',
    symptoms: [
      'Search results show the URL instead of a headline',
      'Browser tabs display the domain or “localhost” with no name',
      'Shared links and bookmarks have no readable label',
      'Lighthouse reports “Document does not have a `<title>` element”',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing page title',
      threshold: 'document.title is empty',
    },
    rootCauses: [
      'The head is never managed — the app only renders into `<body>`',
      'A per-route title was planned but never wired to a head manager or metadata API',
      'The base HTML template shipped with an empty `<title></title>`',
    ],
    fix: {
      summary:
        'Give every route a unique, descriptive `<title>` of roughly 30–60 characters that front-loads the page’s topic. Set it per page — a single site-wide title is almost as bad as none.',
      steps: [
        'Decide a unique, keyword-led title for the route',
        'Set it via your framework’s head/metadata mechanism',
        'Verify it appears in the browser tab and in view-source',
      ],
      code: [
        {
          lang: 'html',
          code: `<head>
  <title>Invoicing for freelancers — Acme</title>
</head>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Use the App Router Metadata API. Export a static `metadata` object, or `generateMetadata` for dynamic routes; a title template in the root layout keeps branding consistent.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata',
        code: [
          {
            lang: 'tsx',
            caption: 'app/pricing/page.tsx',
            code: `import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing — Acme',
}`,
          },
        ],
      },
      react: {
        note: 'React 19 hoists a `<title>` rendered anywhere in your tree into the document head — no helmet library needed. On React 18, use `react-helmet-async`.',
        code: [
          {
            lang: 'tsx',
            caption: 'React 19',
            code: `export function PricingPage() {
  return (
    <>
      <title>Pricing — Acme</title>
      {/* page content */}
    </>
  )
}`,
          },
        ],
      },
      vue: {
        note: 'Set the title reactively with `@unhead/vue`’s `useHead` (built into Nuxt).',
        docsUrl: 'https://unhead.unjs.io/usage/composables/use-head',
        code: [
          {
            lang: 'vue',
            code: `<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({ title: 'Pricing — Acme' })
</script>`,
          },
        ],
      },
      svelte: {
        note: 'Put a `<title>` inside `<svelte:head>` on the page component; it is set per route.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <title>Pricing — Acme</title>
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Set the `<title>` in each page’s static `<head>`, or assign `document.title` at runtime for a client-rendered view.',
        code: [
          {
            lang: 'html',
            code: `<title>Pricing — Acme</title>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'How long should a page title be?',
        a: 'Aim for 30–60 characters. Google truncates around 60, so keep the important keywords first and the brand name last.',
      },
      {
        q: 'Should every page have a different title?',
        a: 'Yes. Duplicate titles across routes confuse search engines about which page to rank. Give each route a title that reflects its unique content.',
      },
      {
        q: 'Where should the brand name go?',
        a: 'At the end, after a separator: “Pricing — Acme”. Front-load the page-specific keywords because the end is what gets truncated.',
      },
    ],
    related: ['placeholder-page-title', 'title-too-long', 'missing-meta-description', 'missing-og-title'],
  },

  {
    slug: 'title-too-long',
    category: 'seo',
    detector: 'seo',
    checkId: 'title-too-long',
    severity: 'warning',
    title: 'Fix a page title that is too long',
    metaDescription:
      'Google truncates titles past ~60 characters, hiding the end in search results. Trim your <title> so the whole headline shows.',
    h1: 'Page title is too long',
    pain: 'Google truncates the visible title in search results at roughly 60 characters (about 600 pixels), so anything past that is replaced with an ellipsis. A long, keyword-stuffed title buries your call to action where nobody sees it. Auto-generated titles that append the full site name and section path overflow this budget constantly.',
    symptoms: [
      'Search snippets end in “…” mid-phrase',
      'The most important words sit past the cut-off',
      'Titles read like breadcrumbs: “Section · Subsection · Page · Brand · Tagline”',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Page title is too long',
      threshold: '<title> longer than 60 characters (TITLE_MAX)',
    },
    rootCauses: [
      'A title template concatenates page + section + brand + tagline',
      'Keyword stuffing to “cover” more search terms',
      'The brand name is long and repeated in every title',
    ],
    fix: {
      summary:
        'Keep titles at or under 60 characters. Lead with the unique, page-specific phrase and keep the brand suffix short. Drop redundant separators and section names that add length without meaning.',
      steps: [
        'Count the characters in your rendered title',
        'Cut section/tagline noise and front-load the topic keywords',
        'Re-check that it renders under 60 characters',
      ],
      code: [
        {
          lang: 'html',
          caption: 'Before (74 chars) → after (28 chars)',
          code: `<!-- too long -->
<title>Pricing Plans and Packages · Products · Acme Software Inc. · Home</title>

<!-- trimmed -->
<title>Pricing — Acme</title>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Use a title template in the root layout so each page only supplies the short, unique part and the brand suffix is added once.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata#title',
        code: [
          {
            lang: 'tsx',
            caption: 'app/layout.tsx — template; pages set only the leaf',
            code: `export const metadata: Metadata = {
  title: {
    template: '%s — Acme',
    default: 'Acme',
  },
}
// app/pricing/page.tsx → title: 'Pricing' renders "Pricing — Acme"`,
          },
        ],
      },
      react: {
        note: 'Render a concise `<title>` directly (React 19). Compute it so it can’t exceed your budget.',
        code: [
          {
            lang: 'tsx',
            code: `<title>{\`\${page} — Acme\`}</title>`,
          },
        ],
      },
      vue: {
        note: 'Use `@unhead/vue` with a `titleTemplate` so the brand suffix is centralised.',
        code: [
          {
            lang: 'ts',
            code: `useHead({
  title: 'Pricing',
  titleTemplate: (t) => (t ? \`\${t} — Acme\` : 'Acme'),
})`,
          },
        ],
      },
      svelte: {
        note: 'Keep the `<svelte:head>` title short; centralise the brand suffix in your layout.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <title>Pricing — Acme</title>
</svelte:head>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What is the exact title length limit?',
        a: 'Google renders titles by pixel width (~600px), which is about 60 characters for average text. VibeCheck flags anything over 60 characters.',
      },
      {
        q: 'Does a long title hurt ranking or just display?',
        a: 'Mostly display — the truncated part still counts a little, but the practical harm is a weaker, cut-off headline that lowers click-through. Keep it readable.',
      },
    ],
    related: ['missing-page-title', 'title-too-short', 'placeholder-page-title', 'meta-description-too-long'],
  },

  {
    slug: 'placeholder-page-title',
    category: 'seo',
    detector: 'seo',
    checkId: 'title-default',
    severity: 'error',
    title: 'Fix a placeholder page title (React App, Untitled)',
    metaDescription:
      'Shipping a default title like “React App” or “Vite App” tells Google your page is an unfinished template. Replace it with a real title.',
    h1: 'Page title is a framework default',
    pain: 'A title like “React App”, “Vite App”, or “Untitled” is the scaffold’s placeholder — shipping it signals to Google (and to any human) that the page is unfinished. Every search result and browser tab shows the generic string, and identical titles across your whole site collapse your pages into one indistinct blob. This is the most common title mistake in AI-built and starter-template projects.',
    symptoms: [
      'Every tab and search result reads “React App” / “Vite App” / “My App”',
      'All routes share one identical, generic title',
      'The title clearly came from create-react-app, Vite, or a starter template',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Page title is a framework default',
      threshold: "title matches a known placeholder (e.g. 'React App', 'Vite App', 'Untitled')",
    },
    rootCauses: [
      'The starter template’s default `<title>` in `index.html` was never changed',
      'The app renders into `<body>` and no route ever overrides the placeholder',
      'A copied boilerplate carried its original title through',
    ],
    fix: {
      summary:
        'Replace the placeholder with a real, descriptive title — set a sensible site-wide default in the base template AND a unique per-route title. Never ship the scaffold’s default string.',
      steps: [
        'Search the project for the placeholder string (e.g. “React App”)',
        'Replace the base template default with your real brand/home title',
        'Add unique per-route titles via your framework’s metadata mechanism',
      ],
      code: [
        {
          lang: 'html',
          caption: 'index.html — replace the scaffold default',
          code: `<!-- scaffold default -->
<title>Vite + React</title>

<!-- real default -->
<title>Acme — Invoicing for freelancers</title>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set a real `default` in the root layout’s title template so no route can fall back to a placeholder, then give each page its own title.',
        code: [
          {
            lang: 'tsx',
            caption: 'app/layout.tsx',
            code: `export const metadata: Metadata = {
  title: {
    default: 'Acme — Invoicing for freelancers',
    template: '%s — Acme',
  },
}`,
          },
        ],
      },
      react: {
        note: 'Change the placeholder in `index.html` AND set a real per-view `<title>` (React 19) or via `react-helmet-async`.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<title>Acme — Invoicing for freelancers</title>`,
          },
        ],
      },
      vue: {
        note: 'Update `index.html` and set per-route titles with `useHead`.',
        code: [
          {
            lang: 'ts',
            code: `useHead({ title: 'Acme — Invoicing for freelancers' })`,
          },
        ],
      },
      vanilla: {
        note: 'Replace the placeholder `<title>` in each HTML entry point with a real, page-specific title.',
        code: [
          {
            lang: 'html',
            code: `<title>Acme — Invoicing for freelancers</title>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Which titles does VibeCheck treat as placeholders?',
        a: 'Common scaffold defaults: “untitled”, “document”, “app”, “my site”, “home”, “react app”, “create react app”, “vite app”, “vite + react”, and “next app”.',
      },
      {
        q: 'Why is this an error and not just a warning?',
        a: 'A placeholder title actively misrepresents the page to search engines and users on every route at once, so it is scored more severely than a merely missing one.',
      },
    ],
    related: ['missing-page-title', 'title-too-short', 'title-too-long', 'missing-meta-description'],
  },

  {
    slug: 'title-too-short',
    category: 'seo',
    detector: 'seo',
    checkId: 'title-too-short',
    severity: 'warning',
    title: 'Fix a page title that is too short',
    metaDescription:
      'A one- or two-word <title> wastes your strongest ranking signal. Write a descriptive 30–60 character title with real keywords.',
    h1: 'Page title is very short',
    pain: 'A title like “Home” or “Blog” throws away your most valuable ranking real estate. It gives search engines almost no topical signal and gives searchers no reason to click. Short titles usually mean a route was labelled quickly and never revisited.',
    symptoms: [
      'Titles are single words: “Home”, “Blog”, “App”',
      'Search snippets look bare and generic',
      'No target keywords appear in the title at all',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Page title is very short',
      threshold: 'non-default title under 10 characters',
    },
    rootCauses: [
      'A nav label was reused verbatim as the page title',
      'No keyword research informed the title',
      'The brand suffix was dropped, leaving only a bare word',
    ],
    fix: {
      summary:
        'Expand the title to a descriptive 30–60 character phrase that includes the page’s primary keyword and the brand. Say what the page is about, not just what it is called in the nav.',
      steps: [
        'Identify the page’s primary keyword or intent',
        'Write a 30–60 character title that includes it plus the brand',
        'Confirm it is unique across your routes',
      ],
      code: [
        {
          lang: 'html',
          caption: 'Before → after',
          code: `<!-- too short -->
<title>Blog</title>

<!-- descriptive -->
<title>Engineering blog — scaling Postgres — Acme</title>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Give the route a descriptive metadata title; use the layout template only for the brand suffix.',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  title: 'Engineering blog — scaling Postgres',
}`,
          },
        ],
      },
      react: {
        note: 'Render a fuller, keyword-led `<title>` (React 19).',
        code: [
          {
            lang: 'tsx',
            code: `<title>Engineering blog — scaling Postgres — Acme</title>`,
          },
        ],
      },
      svelte: {
        note: 'Expand the `<svelte:head>` title into a descriptive phrase.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <title>Engineering blog — scaling Postgres — Acme</title>
</svelte:head>`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What is the minimum title length?',
        a: 'There is no hard rule, but under ~10 characters almost never carries enough signal. Aim for 30–60 characters that describe the page and include a keyword.',
      },
      {
        q: 'Can the title just be the nav label?',
        a: 'Nav labels are short by design. Titles should be fuller — “Pricing” in the nav can be “Pricing & plans for teams — Acme” as the title.',
      },
    ],
    related: ['missing-page-title', 'title-too-long', 'placeholder-page-title', 'missing-meta-description'],
  },

  {
    slug: 'missing-meta-description',
    category: 'seo',
    detector: 'seo',
    checkId: 'meta-description-missing',
    severity: 'warning',
    title: 'Fix a missing meta description',
    metaDescription:
      'No meta description lets Google write its own snippet from page text — usually a worse pitch. Add a 150–160 character summary.',
    h1: 'Missing meta description',
    pain: 'The meta description is the paragraph under your title in search results — your one chance to pitch the click. Without it, Google scrapes some text off the page and often picks a boilerplate or nav fragment. AI-built pages skip it because it lives in `<head>`, which the generated components never touch.',
    symptoms: [
      'Search snippets are auto-generated and off-message',
      'Different queries surface random fragments of your page as the snippet',
      'No control over the sentence that sells the click',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Missing meta description',
      threshold: 'no <meta name="description">',
    },
    rootCauses: [
      'The `<head>` is unmanaged, so no description tag is emitted',
      'Descriptions were considered “optional” and skipped',
      'A per-route description was never written',
    ],
    fix: {
      summary:
        'Write a unique 150–160 character description per page that summarises the content and includes a reason to click. It does not directly affect ranking, but a compelling snippet lifts click-through, which does.',
      steps: [
        'Write a 150–160 character summary with the page’s value and a keyword',
        'Emit it as `<meta name="description">` via your head/metadata mechanism',
        'Confirm it appears in view-source and is unique per route',
      ],
      code: [
        {
          lang: 'html',
          code: `<meta name="description" content="Send branded invoices in under a minute, track payments, and chase overdue clients automatically. Built for freelancers." />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Set `description` in the route’s metadata object (or `generateMetadata` for dynamic pages).',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-metadata',
        code: [
          {
            lang: 'tsx',
            code: `export const metadata: Metadata = {
  title: 'Pricing — Acme',
  description: 'Simple per-seat pricing with a 14-day free trial. No card required to start.',
}`,
          },
        ],
      },
      react: {
        note: 'Render `<meta name="description">` in the component (React 19 hoists it to `<head>`).',
        code: [
          {
            lang: 'tsx',
            code: `<meta name="description" content="Simple per-seat pricing with a 14-day free trial." />`,
          },
        ],
      },
      vue: {
        note: 'Add it to `useHead`’s meta array.',
        code: [
          {
            lang: 'ts',
            code: `useHead({
  meta: [{ name: 'description', content: 'Simple per-seat pricing with a 14-day free trial.' }],
})`,
          },
        ],
      },
      svelte: {
        note: 'Place the meta tag inside `<svelte:head>`.',
        code: [
          {
            lang: 'svelte',
            code: `<svelte:head>
  <meta name="description" content="Simple per-seat pricing with a 14-day free trial." />
</svelte:head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add the meta tag to each page’s `<head>`.',
        code: [
          {
            lang: 'html',
            code: `<meta name="description" content="Simple per-seat pricing with a 14-day free trial." />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Does a meta description affect ranking?',
        a: 'Not directly. It affects click-through rate by controlling the snippet, and higher CTR is a positive signal. Treat it as ad copy for the search result.',
      },
      {
        q: 'How long should it be?',
        a: 'About 150–160 characters. Longer gets truncated; much shorter wastes the space. Make each one unique to the page.',
      },
      {
        q: 'Will Google always use my description?',
        a: 'No — Google may rewrite the snippet to match the query. A good description still wins the majority of the time and is worth writing.',
      },
    ],
    related: ['meta-description-too-long', 'missing-page-title', 'missing-og-description', 'missing-og-image'],
  },

  {
    slug: 'meta-description-too-long',
    category: 'seo',
    detector: 'seo',
    checkId: 'meta-description-too-long',
    severity: 'warning',
    title: 'Fix a meta description that is too long',
    metaDescription:
      'Search engines cut descriptions off past ~160 characters. Trim yours so the call to action is not lost in the ellipsis.',
    h1: 'Meta description is too long',
    pain: 'Search engines truncate the snippet at roughly 160 characters, so a long description loses its ending — often the exact call to action you wanted seen. Descriptions pulled from the first paragraph of content routinely overflow this budget.',
    symptoms: [
      'The snippet ends in “…” before your point lands',
      'The call to action is cut off',
      'Descriptions were copied from body copy rather than written to fit',
    ],
    detection: {
      detector: 'seo',
      issueString: 'Meta description is too long',
      threshold: 'meta description longer than 160 characters (DESC_MAX)',
    },
    rootCauses: [
      'The description was lifted from a full paragraph of content',
      'Multiple sentences were packed in “to be safe”',
      'No character budget was enforced when generating descriptions',
    ],
    fix: {
      summary:
        'Trim the description to 150–160 characters, keeping the value proposition and call to action in the first ~155. Write it to fit rather than truncating body copy.',
      steps: [
        'Count the characters in the rendered description',
        'Rewrite it to land the key message within ~155 characters',
        'Re-check it renders in full in a search preview tool',
      ],
      code: [
        {
          lang: 'html',
          caption: 'Trimmed to ~150 chars',
          code: `<meta name="description" content="Track every invoice and payment in one place, and auto-chase overdue clients. Free for your first 5 invoices." />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Keep the metadata `description` within budget; a shared helper can hard-trim to 160 as a safety net.',
        code: [
          {
            lang: 'tsx',
            code: `const clamp = (s: string, n = 160) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…')

export const metadata: Metadata = {
  description: clamp(summary),
}`,
          },
        ],
      },
      react: {
        note: 'Clamp the content string before rendering the meta tag.',
        code: [
          {
            lang: 'tsx',
            code: `<meta name="description" content={summary.slice(0, 160)} />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What is the ideal meta description length?',
        a: '150–160 characters. That fits the desktop snippet without truncation while still giving room to pitch.',
      },
      {
        q: 'Is it bad to go over 160?',
        a: 'It is not penalised, but the extra text is simply hidden. Put everything that matters in the first ~155 characters.',
      },
    ],
    related: ['missing-meta-description', 'title-too-long', 'missing-og-description', 'missing-page-title'],
  },
]
