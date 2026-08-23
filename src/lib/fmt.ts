/* formatting helpers (INR + order codes + time) */

const INR_FMT = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
export function inr(paise: number | null | undefined): string {
  return '\u20B9' + INR_FMT.format((paise || 0) / 100)
}

export type OrderLike = { section: string; tokenNo?: number; token_no?: number }
/** Order code with counter letter: B-12 (boys), G-7 (girls) */
export function ordNo(o: OrderLike | null | undefined): string {
  if (!o) return ''
  const n = o.tokenNo ?? o.token_no ?? 0
  return (o.section === 'girls' ? 'G-' : 'B-') + n
}

export function timeAgo(ts: string): string {
  const t = new Date(ts).getTime()
  if (!isFinite(t)) return ''
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return m + ' min ago'
  const h = Math.floor(m / 60)
  if (h < 24 && new Date().toDateString() === new Date(t).toDateString()) return h + ' hr ago'
  return new Date(t).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

export function clockTime(ts: string): string {
  const d = new Date(ts)
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export const STATUS_META: Record<string, { label: string; cls: string }> = {
  placed: { label: 'Sent', cls: 'bp-placed pulse' },
  completed: { label: 'Served \u2713', cls: 'bp-completed' },
  cancelled: { label: 'Cancelled', cls: 'bp-cancelled' },
}
export function statusPill(status: string): string {
  const m = STATUS_META[status] || { label: status, cls: '' }
  // rendered via dangerouslySetInnerHTML-free approach in components
  return m.label
}
export function statusCls(status: string): string {
  return (STATUS_META[status] || { cls: '' }).cls
}

export type MenuItem = {
  id: number
  name: string
  emoji: string
  category: string
  price: number
  stock: number
  available: boolean
  sold?: number
}
export type OrderItem = { name: string; emoji: string | null; price: number; qty: number; lineTotal: number }
export type Order = {
  id: number
  tokenNo: number
  section: string
  status: string
  total: number
  createdAt: string
  items: OrderItem[]
}
