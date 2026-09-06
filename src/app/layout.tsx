import type { Metadata, Viewport } from 'next'
import './globals.css'
import { UiHost } from '@/lib/ui'
import { GateLock } from '@/lib/gate'

export const metadata: Metadata = {
  title: 'Syllabites · Campus Food Court',
  description: 'Phone-first food court ordering — Boys & Girls counters',
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
  return (
    <html lang="en">
      <body>
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
        </div>
      </body>
    </html>
  )
}
