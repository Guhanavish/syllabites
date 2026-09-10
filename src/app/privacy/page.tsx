import type { Metadata } from 'next'
import { Crumbs } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Privacy Policy | Syllabites',
  description: 'Privacy policy for Syllabites: what order details are stored, who can see them, and how long they are kept.',
  alternates: { canonical: '/privacy' },
}

export default function PrivacyPage() {
  return (
    <div className="root">
      <div className="scroll">
        <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Privacy' }]} />
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13, marginTop: 6 }}>
          Last updated September 2026. Short version: we store what the counter needs to serve your food, and nothing else.
        </p>
        <div className="card pad" style={{ marginTop: 14, display: 'grid', gap: 12, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>1. Data we collect</h2>
            <p>Counter orders store the items, quantities, totals, and order status. Parcel orders additionally store the name, class, section, and event you type in, so staff can match the pickup code to the right person. Devices register an anonymous presence heartbeat so the admin can see how many counter screens are live.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>2. Who can see it</h2>
            <p>Counter staff see live orders for their counter. Parcel pickup codes are shown only to the person who placed the order. Prices, sales totals, and customer lists are visible only in the admin panel. We do not sell data or show ads.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>3. Passwords</h2>
            <p>App, section, and admin passwords are stored as one-way hashes and are never shown back. Enter them only on your own counter screens.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>4. Retention</h2>
            <p>Order history is kept for counter records and sales reports. Backups are stored in the project database so a mistaken reset can be undone. Ask the admin if you need an order detail corrected.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>5. Contact</h2>
            <p>For privacy questions, speak to the counter admin or reach the site operator through the links on the home screen.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
