import type { MetadataRoute } from 'next'

export const sitemap = (): MetadataRoute.Sitemap => [
  {
    url: 'https://example.com/',
    lastModified: new Date('2026-10-30'),
  },
]

export default sitemap
