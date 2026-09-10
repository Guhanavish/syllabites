import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Counter Menu | Syllabites',
  description: 'Browse the live Boys and Girls counter menu and send orders from your phone.',
  alternates: { canonical: '/sender' },
}

export default function SenderLayout({ children }: { children: React.ReactNode }) {
  return children
}
