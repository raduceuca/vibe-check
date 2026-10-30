import type { MetadataRoute } from 'next'

export const robots = (): MetadataRoute.Robots => ({
  rules: [
    {
      userAgent: '*',
      allow: '/',
    },
    {
      userAgent: 'GPTBot',
      allow: '/',
    },
  ],
  sitemap: 'https://example.com/sitemap.xml',
})

export default robots
