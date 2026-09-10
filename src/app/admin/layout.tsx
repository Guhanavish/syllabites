import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Panel | Syllabites',
  description: 'Admin panel for Syllabites: menus, stock, orders, sales, discounts, and backups.',
  alternates: { canonical: '/admin' },
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
