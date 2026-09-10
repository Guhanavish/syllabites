'use client'

/* Shared footer with internal links. Rendered on public screens so every
   page is one tap from the rest, and legal pages are always reachable. */
import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer
      style={{
        textAlign: 'center',
        padding: '20px 12px 8px',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--muted)',
      }}
    >
      <nav aria-label="Site" style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Link href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</Link>
        <Link href="/sender" style={{ color: 'inherit', textDecoration: 'none' }}>Counter menu</Link>
        <Link href="/receiver" style={{ color: 'inherit', textDecoration: 'none' }}>Counter board</Link>
        <Link href="/terms" style={{ color: 'inherit', textDecoration: 'none' }}>Terms</Link>
        <Link href="/privacy" style={{ color: 'inherit', textDecoration: 'none' }}>Privacy</Link>
      </nav>
      <div style={{ marginTop: 8, fontSize: 11, letterSpacing: '0.02em', opacity: 0.9 }}>
        Built by Guhanavish, Class XI. Inspired by Harish C, Class XII.
      </div>
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
