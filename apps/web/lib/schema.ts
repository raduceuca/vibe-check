import { SITE_NAME, SITE_URL, GITHUB_URL } from './site'

// ── Shared schema.org nodes ──────────────────────────────────────────────────
// Canonical @id-addressed Organization / Person / WebSite nodes, reused across
// docs, /fix hub, and /fix category pages so their JSON-LD is self-contained and
// their identity references stay consistent with the landing page's graph. This
// is the AEO surface VibeCheck's own aeo audit reads (structured-data-*).

// A loose JSON value type — JSON-LD is plain data serialized into a script tag.
export type Json = string | number | boolean | null | Json[] | { readonly [k: string]: Json }

export const ORG_ID = `${SITE_URL}#org`
export const AUTHOR_ID = `${GITHUB_URL}#author`
export const WEBSITE_ID = `${SITE_URL}#website`

export const AUTHOR_NAME = 'Radu Ceuca'

// Site-wide freshness anchors. Constants (not `new Date()`) so statically
// prerendered HTML is deterministic across builds.
export const DATE_PUBLISHED = '2025-11-01'
export const DATE_MODIFIED = '2026-07-06'

export const organizationNode: Json = {
  '@type': 'Organization',
  '@id': ORG_ID,
  name: SITE_NAME,
  url: SITE_URL,
  sameAs: [GITHUB_URL],
}

export const personNode: Json = {
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: AUTHOR_NAME,
  url: GITHUB_URL,
}

export const websiteNode: Json = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  name: SITE_NAME,
  url: SITE_URL,
  publisher: { '@id': ORG_ID },
}
