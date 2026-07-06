import type { MetadataRoute } from 'next'
import { SITE_URL, absoluteUrl } from '@/lib/site'

// Allow every crawler — including AI answer engines (GPTBot, ClaudeBot,
// PerplexityBot, …), which the wildcard rule covers — and point to the sitemap.
// This is the config VibeCheck's own aeo audit wants to see (no AI crawlers
// blocked), dogfooded.

const robots = (): MetadataRoute.Robots => ({
  rules: [{ userAgent: '*', allow: '/' }],
  sitemap: absoluteUrl('/sitemap.xml'),
  host: SITE_URL,
})

export default robots
