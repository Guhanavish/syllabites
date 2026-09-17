'use client'

import Link from 'next/link'
import { Credits } from '@/components/brand'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav className="site-footer-links" aria-label="Site">
        <Link href="/">Home</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
      </nav>
      <Credits />
    </footer>
  )
}

export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 12 }}>
      {trail.map((t, i) => (
        <span key={t.label}>
          {i > 0 && <span style={{ margin: '0 6px' }}>/</span>}
          {t.href ? (
            <Link href={t.href} style={{ color: 'inherit', textDecoration: 'none' }}>{t.label}</Link>
          ) : (
            <span style={{ color: 'var(--ink)' }}>{t.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
