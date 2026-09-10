import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/sender', '/receiver', '/terms', '/privacy']
  return pages.map((p) => ({
    url: p,
    lastModified: new Date(),
    changeFrequency: p === '' ? 'daily' : 'weekly',
    priority: p === '' ? 1 : 0.6,
  }))
}
