import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import incrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// ── OpenNext × Cloudflare adapter config ─────────────────────────────────────
// Transforms the standard `next build` output into a Cloudflare Worker. SSR +
// route handlers run in the Worker (Node compat); static assets are served from
// the ASSETS binding declared in wrangler.jsonc.
//
// incrementalCache = static-assets: the ~200 prerendered /fix pages set
// `dynamicParams = false`, so a cache miss is a hard 404 — they MUST be served
// from a real incremental cache. The static-assets backend serves them straight
// out of the Worker's own assets (no R2/KV account needed), which fits a site
// that only serves prerendered data and never revalidates. Switch to
// r2IncrementalCache if on-demand ISR / revalidation is ever introduced.
export default {
  ...defineCloudflareConfig({ incrementalCache }),
  // Pin the build command. OpenNext otherwise auto-detects the packager and runs
  // `pnpm build` — the same thing — but pinning removes any doubt that the WEBPACK
  // builder is used (this project runs `next build --webpack` because Turbopack
  // trips a fumadocs-mdx bug). OpenNext wraps this command in standalone-output
  // mode, so it must NOT be run with --skipNextBuild.
  buildCommand: 'pnpm build',
}

