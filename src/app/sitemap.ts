import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  // NOTE: /sender and /receiver are password-gated staff screens,
  // so they are intentionally excluded from the sitemap and set noindex.
  const pages = ['', '/terms', '/privacy']
  return pages.map((p) => ({
    url: p,
    lastModified: new Date(),
    changeFrequency: p === '' ? 'daily' : 'weekly',
    priority: p === '' ? 1 : 0.6,
  }))
}
