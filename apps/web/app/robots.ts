import type { MetadataRoute } from 'next'
import { SITE_URL, absoluteUrl } from '@/lib/site'

// robots.txt — every crawler is allowed, and the major AI answer-engine agents
// are named explicitly so it's unambiguous they may read and cite the site (the
// config VibeCheck's own aeo audit wants to see: no AI crawlers blocked).
// The curated markdown map for LLMs lives at /llms.txt (and /llms-full.txt) by
// convention.

// Major AI / answer-engine crawler user-agents, allowed explicitly.
const AI_CRAWLERS: readonly string[] = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
  'cohere-ai',
  'Bytespider',
  'Amazonbot',
  'Meta-ExternalAgent',
]

const robots = (): MetadataRoute.Robots => ({
  rules: [
    { userAgent: '*', allow: '/' },
    ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
  ],
  sitemap: absoluteUrl('/sitemap.xml'),
  host: SITE_URL,
})

export default robots
