import Link from 'next/link'
import type { Metadata } from 'next'
import { IconReceipt } from '@/components/icons'

export const metadata: Metadata = {
  title: 'Page not found | Syllabites',
  description: 'The page you asked for is not on the Syllabites menu.',
  robots: { index: false, follow: false },
}

export default function NotFound() {  return (
    <div className="root">
      <div className="scroll">
        <div className="empty">
          <span className="e-ico" aria-hidden="true"><IconReceipt size={24} /></span>
          <h1 style={{ fontSize: 20, fontWeight: 900, marginTop: 14 }}>Page not found</h1>
          <p>The page you asked for is not on the menu. It may have moved or the link may be wrong.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" href="/" style={{ textDecoration: 'none' }}>Back to home</Link>
            <Link className="btn btn-ghost" href="/sender" style={{ textDecoration: 'none' }}>Counter menu</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
