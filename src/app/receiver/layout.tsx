import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Counter Board | Syllabites',
  description: 'Live counter board for Boys and Girls volunteers to serve incoming orders.',
  alternates: { canonical: '/receiver' },
  robots: { index: false, follow: false },
}

export default function ReceiverLayout({ children }: { children: React.ReactNode }) {
  return children
}
