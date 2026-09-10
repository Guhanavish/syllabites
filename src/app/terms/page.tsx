import type { Metadata } from 'next'
import { Crumbs } from '@/components/site-chrome'

export const metadata: Metadata = {
  title: 'Terms of Use | Syllabites',
  description: 'Terms of use for Syllabites campus food court ordering: counters, pickup codes, payments at the counter, and fair use.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <div className="root">
      <div className="scroll">
        <Crumbs trail={[{ label: 'Home', href: '/' }, { label: 'Terms' }]} />
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.01em' }}>Terms of Use</h1>
        <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13, marginTop: 6 }}>
          Last updated September 2026. Syllabites is a counter tool for a campus food court.
        </p>
        <div className="card pad" style={{ marginTop: 14, display: 'grid', gap: 12, fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', lineHeight: 1.6 }}>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>1. What Syllabites does</h2>
            <p>Staff on the Boys and Girls counters take orders on phones and serve them from counter screens. Visitors at the entrance can place parcel orders and get a 6-digit pickup code. The admin panel manages menus, stock, sales, and discounts.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>2. Orders and pickup</h2>
            <p>An order is confirmed only when the screen shows its order number or pickup code. Food is handed over at the counter against that number. Keep parcel codes private, since anyone with the code could claim the food.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>3. Prices and payment</h2>
            <p>Prices are shown in INR where the menu is visible. Payment happens at the counter, not inside this app. If a price looks wrong, ask the volunteers before ordering.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>4. Fair use</h2>
            <p>Do not place fake orders, hoard stock, share counter or admin passwords, or try to disrupt the service. Counters may cancel abusive orders and change access passwords at any time.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>5. Availability</h2>
            <p>The service runs during counter hours and may pause for restocking, power cuts, or network issues. Menus and stock change through the day.</p>
          </section>
          <section>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>6. Contact</h2>
            <p>For order help, speak to the volunteers at the counter. For anything about this app, contact the site operator through the links on the home screen.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
