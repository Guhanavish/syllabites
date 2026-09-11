import type { Metadata, Viewport } from 'next'
import './globals.css'
import { UiHost } from '@/lib/ui'
import { GateLock } from '@/lib/gate'
import { CookieNotice } from '@/components/cookie-notice'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://syllabites.vercel.app'),
  title: {
    default: 'Syllabites · Campus Food Court Ordering',
    template: '%s | Syllabites',
  },
  description: 'Order from the Boys and Girls food counters on your phone, or place an entrance parcel order with a pickup code.',
  applicationName: 'Syllabites',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.svg',
  },
  openGraph: {
    type: 'website',
    siteName: 'Syllabites',
    title: 'Syllabites · Campus Food Court Ordering',
    description: 'Live counter menus for Boys and Girls, plus entrance parcel orders with pickup codes.',
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'Syllabites campus food court ordering' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Syllabites · Campus Food Court Ordering',
    description: 'Live counter menus for Boys and Girls, plus entrance parcel orders with pickup codes.',
    images: [{ url: '/og.svg', alt: 'Syllabites campus food court ordering' }],
  },
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  userScalable: false,
  themeColor: '#1c1410',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  let sbOrigin = ''
  try { sbOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin } catch {}
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FoodEstablishment',
    name: 'Syllabites',
    description: 'Campus food court ordering for Boys and Girls counters, plus entrance parcel orders.',
    servesCuisine: ['Snacks', 'Fast Food', 'Beverages'],
    priceRange: '₹',
  }
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Syllabites',
    description: 'Campus food court ordering for Boys and Girls counters.',
  }
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        {sbOrigin ? (
          <>
            <link rel="preconnect" href={sbOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={sbOrigin} />
          </>
        ) : null}
        <div className="phone" id="phone">
          <GateLock>
            {children}
          </GateLock>
          <UiHost />
          <CookieNotice />
        </div>
      </body>
    </html>
  )
}
