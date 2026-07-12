import type { Problem } from './types'

// ── Web-essentials problems (web-essentials detector, 4 checks) ──────────────
// Document-head fundamentals every page needs. Source: packages/core/src/
// detectors/webEssentials.ts. AI scaffolds frequently drop these because the
// generated component only owns the <body>, and nobody edits index.html.

export const essentialsProblems: readonly Problem[] = [
  {
    slug: 'missing-viewport-meta',
    category: 'essentials',
    detector: 'web-essentials',
    checkId: 'viewport',
    severity: 'error',
    title: 'Fix a missing viewport meta tag',
    metaDescription:
      'Without a viewport meta tag, mobile browsers render your page at desktop width. Add one line to make the layout responsive again.',
    h1: 'Missing viewport meta tag',
    pain: 'Without `<meta name="viewport">`, mobile browsers assume a ~980px desktop canvas and shrink the whole page to fit, so text is unreadable and tap targets are tiny. AI scaffolds often generate the component tree but leave the base HTML document untouched, so this one line never gets added. It is the single biggest reason an otherwise-fine page looks broken on a phone.',
    symptoms: [
      'Page looks zoomed-out on mobile — everything is tiny',
      'Users have to pinch-to-zoom to read or tap anything',
      'CSS media queries never fire because the layout viewport is 980px, not the device width',
      'Lighthouse flags "Does not have a <meta name="viewport">"',
    ],
    detection: {
      detector: 'web-essentials',
      issueString: 'Missing viewport meta tag',
      threshold: 'No <meta name="viewport"> present in the document head',
    },
    rootCauses: [
      'The framework template (`index.html` / `app.html`) was edited to remove it, or a hand-rolled HTML shell never had it',
      'Meta tags are managed in a head library but the viewport was never configured',
      'A generated single-file export dropped the document `<head>`',
    ],
    fix: {
      summary:
        'Add a viewport meta tag to the document head. `width=device-width` tells the browser to use the physical device width as the layout viewport; `initial-scale=1` disables the initial zoom. Do not set `maximum-scale` or `user-scalable=no` — that breaks accessibility for users who need to zoom.',
      steps: [
        'Open your document head (`index.html`, `app.html`, or your framework’s metadata config)',
        'Add `<meta name="viewport" content="width=device-width, initial-scale=1">`',
        'Reload on a real phone or device-emulation and confirm the layout uses the full width',
      ],
      code: [
        {
          lang: 'html',
          caption: 'The canonical viewport tag',
          code: '<meta name="viewport" content="width=device-width, initial-scale=1" />',
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Next.js App Router owns the viewport through the dedicated `viewport` export (do not hand-write the tag — Next injects it). Export it from any layout or page; it merges with the document head automatically.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/functions/generate-viewport',
        code: [
          {
            lang: 'tsx',
            caption: 'app/layout.tsx',
            code: `import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}`,
          },
        ],
      },
      react: {
        note: 'A plain Vite/CRA React app renders into a static `index.html`. The viewport tag lives there, not in a component — React never touches `<head>` unless you add a head manager.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>`,
          },
        ],
      },
      vue: {
        note: 'Vite-based Vue apps mount into `index.html`. Add the tag there; for meta you set at runtime, use `@unhead/vue`’s `useHead`.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
          },
        ],
      },
      svelte: {
        note: 'SvelteKit’s document shell is `src/app.html`. The viewport belongs there, alongside `%sveltekit.head%`.',
        code: [
          {
            lang: 'html',
            caption: 'src/app.html',
            code: `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  %sveltekit.head%
</head>`,
          },
        ],
      },
      vanilla: {
        note: 'Put it in the static `<head>` of every HTML entry point. If you template pages server-side, add it to the shared layout partial.',
        code: [
          {
            lang: 'html',
            code: `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Should I set `user-scalable=no` or `maximum-scale=1`?',
        a: 'No. Disabling zoom is a WCAG accessibility failure — users with low vision rely on pinch-to-zoom. `width=device-width`, `initial-scale=1` is all you need.',
      },
      {
        q: 'Does Next.js add the viewport tag automatically?',
        a: 'Next injects a sensible default, but you should declare the `viewport` export explicitly so it is intentional and reviewable. Never hard-code the `<meta>` tag in Next’s App Router.',
      },
      {
        q: 'Why does my media query not work on mobile without this tag?',
        a: 'Without the viewport tag the layout viewport defaults to ~980px, so min-width/max-width breakpoints compare against 980, not the real device width. The tag makes the layout viewport equal the device width.',
      },
    ],
    related: ['missing-charset', 'missing-lang-attribute', 'missing-favicon'],
  },

  {
    slug: 'missing-charset',
    category: 'essentials',
    detector: 'web-essentials',
    checkId: 'charset',
    severity: 'warning',
    title: 'Fix a missing charset declaration',
    metaDescription:
      'A missing <meta charset> lets browsers guess your encoding, mangling emoji and accented text. Declare UTF-8 as the first tag in <head>.',
    h1: 'Missing charset declaration',
    pain: 'With no explicit `<meta charset="utf-8">`, the browser falls back to a guessed encoding and can render “café” as “cafÃ©” or drop emoji entirely. Worse, if the tag appears late in a large `<head>`, the browser may have to restart parsing. It is invisible in dev on modern servers that send a `charset` header, then breaks on a static host that does not.',
    symptoms: [
      'Accented characters and emoji render as garbled “mojibake”',
      'Content looks fine locally but breaks when served from a CDN or file://',
      'The browser restarts HTML parsing after discovering the `charset` late',
    ],
    detection: {
      detector: 'web-essentials',
      issueString: 'Missing charset declaration',
      threshold: 'No element matching <meta charset> in the document head',
    },
    rootCauses: [
      'A hand-written HTML shell omitted it',
      'The `charset` meta was placed after other tags or scripts instead of first',
      'Relying on the HTTP `Content-Type` `charset` header, which is absent on some hosts',
    ],
    fix: {
      summary:
        'Declare UTF-8 as the very first element inside `<head>`, before any other tag or text, so the browser locks the encoding before parsing content. The short form `<meta charset="utf-8">` is the modern standard.',
      steps: [
        'Open your document head',
        'Add `<meta charset="utf-8">` as the first child of `<head>`',
        'Verify accented text and emoji render correctly on a static host',
      ],
      code: [
        {
          lang: 'html',
          caption: 'Must be the first tag in <head>',
          code: `<head>
  <meta charset="utf-8" />
  <!-- everything else follows -->
</head>`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Next.js injects `<meta charSet="utf-8">` automatically for App Router pages — you normally do not add it. If VibeCheck still flags it, you have overridden the document with a custom `app/_document` that dropped it; restore the `charset` there.',
        code: [
          {
            lang: 'html',
            caption: 'Auto-injected by Next — verify it is not stripped',
            code: `<meta charSet="utf-8" />`,
          },
        ],
      },
      react: {
        note: 'Vite/CRA React apps declare it in `index.html` as the first head tag.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>`,
          },
        ],
      },
      vanilla: {
        note: 'Add it as the first line of every page’s `<head>`, or in your server-side layout partial.',
        code: [
          {
            lang: 'html',
            code: `<meta charset="utf-8" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Do I need the long <meta http-equiv="Content-Type"> form?',
        a: 'No. The short `<meta charset="utf-8">` has been valid HTML5 for over a decade and is preferred. Keep it as the first tag in `<head>`.',
      },
      {
        q: 'It works locally — why does VibeCheck still flag it?',
        a: 'Your dev server may send a `charset` in the HTTP header, masking the missing tag. A static host or file:// open won’t, so declare it in the HTML to be safe everywhere.',
      },
    ],
    related: ['missing-viewport-meta', 'missing-lang-attribute'],
  },

  {
    slug: 'missing-lang-attribute',
    category: 'essentials',
    detector: 'web-essentials',
    checkId: 'lang',
    severity: 'warning',
    title: 'Fix a missing lang attribute on <html>',
    metaDescription:
      'A missing lang attribute stops screen readers picking the right voice and search engines detecting language. Add lang to your <html> element.',
    h1: 'Missing lang attribute on <html>',
    pain: 'The `<html lang>` attribute tells screen readers which pronunciation rules and voice to use, and tells search engines the content language for regional ranking. Without it, a screen reader may read English content with a French synthesizer, and translation tools guess. AI scaffolds that generate the app body rarely set the document language.',
    symptoms: [
      'Screen readers use the wrong voice or pronunciation',
      'Browser “translate this page” offers to translate content that is already in the user’s language',
      'Lighthouse/axe report "html element does not have a [lang] attribute"',
    ],
    detection: {
      detector: 'web-essentials',
      issueString: 'Missing lang attribute on <html>',
      threshold: 'document.documentElement has no non-empty lang attribute',
    },
    rootCauses: [
      'The root `<html>` element was generated without a `lang` attribute',
      'A single-page app renders into `<body>` and never sets the document language',
    ],
    fix: {
      summary:
        'Set a valid BCP-47 language tag on the root `<html>` element, e.g. `lang="en"` or `lang="en-US"`. If sections of the page are in another language, add `lang` on those elements too.',
      steps: [
        'Find where the root `<html>` element is defined',
        'Add `lang="en"` (or your primary locale)',
        'For multilingual pages, tag individual sections with their own `lang`',
      ],
      code: [
        {
          lang: 'html',
          code: `<html lang="en">`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'In the App Router you own the `<html>` tag in the root layout — set `lang` there.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/file-conventions/layout',
        code: [
          {
            lang: 'tsx',
            caption: 'app/layout.tsx',
            code: `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
          },
        ],
      },
      react: {
        note: 'Vite/CRA apps set it directly on the static `index.html` `<html>` element.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<!doctype html>
<html lang="en">`,
          },
        ],
      },
      svelte: {
        note: 'SvelteKit sets it in `app.html` on the `<html>` tag. For per-request locales, use the `lang` placeholder and set it in a hook.',
        code: [
          {
            lang: 'html',
            caption: 'src/app.html',
            code: `<html lang="en">`,
          },
        ],
      },
      vue: {
        note: 'Set `lang` on the `<html>` element in `index.html`. For Nuxt, configure it via `app.head.htmlAttrs.lang`.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<html lang="en">`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'What value should `lang` be?',
        a: 'A BCP-47 tag: "en" for English, "en-US" for US English, "de", "pt-BR", etc. Use the most specific tag that is accurate for your content.',
      },
      {
        q: 'Do I need `lang` on elements other than <html>?',
        a: 'Only if part of the page is in a different language. Then add `lang` on that element so assistive tech switches pronunciation just for that region.',
      },
    ],
    related: ['missing-viewport-meta', 'missing-charset', 'missing-image-alt-text'],
  },

  {
    slug: 'missing-favicon',
    category: 'essentials',
    detector: 'web-essentials',
    checkId: 'favicon',
    severity: 'warning',
    title: 'Fix a missing favicon',
    metaDescription:
      'No favicon means a blank browser tab and a 404 on every load. Add a <link rel="icon"> so your site is recognisable in tabs and bookmarks.',
    h1: 'Missing favicon',
    pain: 'With no `<link rel="icon">`, browsers request `/favicon.ico` on every page load and get a 404, and your tab shows a generic blank icon. It reads as unfinished — a real product has a recognisable tab icon. AI-generated apps almost never include one because it is an asset, not code.',
    symptoms: [
      'Blank/generic icon in the browser tab and bookmarks',
      'A 404 for `/favicon.ico` in the network panel on every navigation',
      'The site looks unpolished when pinned or bookmarked',
    ],
    detection: {
      detector: 'web-essentials',
      issueString: 'Missing favicon',
      threshold: 'No <link rel="icon"> or <link rel="shortcut icon"> in the document head',
    },
    rootCauses: [
      'No icon asset was ever added to the project',
      'The favicon file exists but no `<link rel="icon">` references it',
    ],
    fix: {
      summary:
        'Add an icon asset and reference it with `<link rel="icon">`. A single SVG favicon covers modern browsers; add a PNG and an `apple-touch-icon` for broader support.',
      steps: [
        'Create or export an icon (SVG preferred, plus a 180×180 PNG for iOS)',
        'Place it in your public/static directory',
        'Reference it with `<link rel="icon">` in `<head>`',
      ],
      code: [
        {
          lang: 'html',
          code: `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />`,
        },
      ],
    },
    frameworkFixes: {
      nextjs: {
        note: 'Next.js uses file conventions: drop `app/icon.png` (or `icon.svg` / `favicon.ico`) into the app directory and Next generates the `<link>` tags automatically — no markup needed.',
        docsUrl: 'https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons',
        code: [
          {
            lang: 'bash',
            caption: 'File-based — Next wires up the <link> for you',
            code: `app/
  favicon.ico      # legacy fallback
  icon.svg         # modern browsers
  apple-icon.png   # 180x180 for iOS`,
          },
        ],
      },
      react: {
        note: 'Put the icon in public/ and reference it from `index.html`.',
        code: [
          {
            lang: 'html',
            caption: 'index.html',
            code: `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
          },
        ],
      },
      svelte: {
        note: 'Place the icon in static/ and link it in `app.html`.',
        code: [
          {
            lang: 'html',
            caption: 'src/app.html',
            code: `<link rel="icon" href="%sveltekit.assets%/favicon.svg" />`,
          },
        ],
      },
      vanilla: {
        note: 'Reference the icon from every page’s `<head>` (or a shared layout partial).',
        code: [
          {
            lang: 'html',
            code: `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`,
          },
        ],
      },
    },
    faq: [
      {
        q: 'Do I still need a `favicon.ico`?',
        a: 'A single SVG favicon works in all modern browsers. Keep a `favicon.ico` only for legacy support; some browsers and crawlers still probe `/favicon.ico` by convention.',
      },
      {
        q: 'What size should the favicon be?',
        a: 'An SVG scales to any size. For raster fallbacks, ship a 32×32 PNG for tabs and a 180×180 `apple-touch-icon` for iOS home-screen bookmarks.',
      },
    ],
    related: ['missing-viewport-meta', 'missing-og-image'],
  },
]
