import type { MetadataRoute } from 'next'
import { ALL_PROBLEMS, CATEGORY_META, getFrameworkParams } from '@/lib/problems'
import { source } from '@/lib/source'
import { absoluteUrl } from '@/lib/site'

// The full sitemap: landing, the /fix hub + category + problem + framework-variant
// pages, and every docs page. Built from the same data that generates the routes,
// so it can never drift from what actually prerenders.

const sitemap = (): MetadataRoute.Sitemap => {
  const now = new Date()

  const entry = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  ): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  })

  const landing = [entry('/', 1, 'weekly'), entry('/fix', 0.9, 'weekly')]
  const categories = CATEGORY_META.map((c) => entry(`/fix/${c.key}`, 0.8, 'weekly'))
  const problems = ALL_PROBLEMS.map((p) => entry(`/fix/${p.slug}`, 0.7, 'monthly'))
  const variants = getFrameworkParams().map((v) =>
    entry(`/fix/${v.slug}/${v.framework}`, 0.5, 'monthly'),
  )
  const docs = source.getPages().map((p) => entry(p.url, 0.6, 'monthly'))

  return [...landing, ...categories, ...problems, ...variants, ...docs]
}

export default sitemap
