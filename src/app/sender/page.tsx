'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sb } from '@/lib/supabase'
import { api } from '@/lib/client'
import { inr, ordNo, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import type { MenuItem, Order } from '@/lib/fmt'
import { toast, buzz, chime, confirmBox } from '@/lib/ui'

type Cart = Record<string, number>

export default function SenderPage() {
  const router = useRouter()
  const [section, setSection] = useState<'boys' | 'girls' | null>(null)
  const [tab, setTab] = useState<'menu' | 'orders'>('menu')
  const [items, setItems] = useState<MenuItem[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [mine, setMine] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [sending, setSending] = useState(false)
  const tokensRef = useRef<{ t: string; id: number }[]>([])

  /* ---------- session guard ---------- */
  useEffect(() => {
    let s: string | null = null
    try { s = localStorage.getItem('fc.section') } catch {}
    if (s !== 'boys' && s !== 'girls') router.replace('/')
    else setSection(s)
  }, [router])

  /* ---------- storage keys ---------- */
  const loadTokens = useCallback((): { t: string; id: number }[] => {
    try { return JSON.parse(localStorage.getItem(`fc.orders.${section}`) || '[]') } catch { return [] }
  }, [section])
  const saveTokens = useCallback((v: { t: string; id: number }[]) => {
    tokensRef.current = v.slice(0, 50)
    localStorage.setItem(`fc.orders.${section}`, JSON.stringify(tokensRef.current))
  }, [section])

  /* ---------- data loaders ---------- */
  const loadMenu = useCallback(async () => {
    try {
      const { data, error } = await sb().from('items').select('*').order('id')
      if (error) throw error
      const list: MenuItem[] = (data || []) as any[]
      setItems(list)
      setCats(['All', ...Array.from(new Set(list.map((i) => i.category)))])
    } catch {}
  }, [])

  const loadMine = useCallback(async () => {
    const toks = loadTokens().map((x) => x.t)
    if (!toks.length) { setMine([]); return }
    try {
      const res = await api<{ length: number }>('/api/orders/mine', { method: 'POST', body: { tokens: toks } })
      setMine(Array.isArray(res) ? (res as unknown as Order[]) : [])
    } catch {}
  }, [loadTokens])

  useEffect(() => {
    if (!section) return
    setCart(JSON.parse(localStorage.getItem(`fc.cart.${section}`) || '{}'))
    tokensRef.current = loadTokens()
    Promise.all([loadMenu(), loadMine()]).then(() => setLoaded(true))
    // safety-net sync every 8s (covers missed live events)
    const p = setInterval(() => { loadMenu(); loadMine() }, 8000)
    return () => clearInterval(p)
  }, [section, loadMenu, loadMine, loadTokens])

  /* clamp cart to reality whenever menu loads */
  useEffect(() => {
    if (!items.length || !section) return
    let changed = false
    const next = { ...cart }
    for (const id of Object.keys(next)) {
      const it = items.find((x) => String(x.id) === id)
      if (!it || !it.available || it.stock === 0) { delete next[id]; changed = true }
      else if (next[id] > it.stock) { next[id] = it.stock; changed = true }
    }
    if (changed) { setCart(next); localStorage.setItem(`fc.cart.${section}`, JSON.stringify(next)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  /* ---------- realtime ---------- */
  useEffect(() => {
    if (!section) return
    const ch = sb()
      .channel('sender-' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadMine())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => loadMenu())
      .subscribe()
    return () => { sb().removeChannel(ch) }
  }, [section, loadMenu, loadMine])

  /* ---------- cart ops ---------- */
  function addToCart(id: number, delta: number) {
    const it = items.find((x) => x.id === id)
    if (!it || !it.available || !section) return
    const next = { ...cart }
    let v = Math.max(0, Math.min((next[id] || 0) + delta, it.stock))
    if (v === 0) delete next[id]; else next[id] = v
    buzz(8)
    setCart(next)
    localStorage.setItem(`fc.cart.${section}`, JSON.stringify(next))
  }

  const totals = Object.entries(cart).reduce(
    (acc, [id, qty]) => {
      const it = items.find((x) => x.id === Number(id))
      if (!it) return acc
      return { count: acc.count + qty, totalP: acc.totalP + it.price * qty }
    },
    { count: 0, totalP: 0 }
  )

  async function sendOrder() {
    if (!totals.count || sending || !section) return
    setSending(true)
    const ct = crypto.randomUUID().replace(/-/g, '')
    try {
      const order = await api<Order>('/api/orders/place', {
        method: 'POST',
        body: {
          section,
          clientToken: ct,
          items: Object.entries(cart).map(([itemId, qty]) => ({ itemId: Number(itemId), qty })),
        },
      })
      saveTokens([{ t: ct, id: order.id }, ...tokensRef.current])
      setCart({})
      localStorage.removeItem(`fc.cart.${section}`)
      buzz([30, 60, 30]); chime()
      toast(`✅ Order ${ordNo(order)} sent! Keep ordering — food is given by this number`, 'ok', 4200)
      loadMine()
    } catch (e: any) {
      toast(e.message || 'Could not send the order', 'bad', 3600)
      loadMenu()
    } finally {
      setSending(false)
    }
  }

  async function cancelOrder(o: Order) {
    const ok = await confirmBox({ title: `Cancel order ${ordNo(o)}?`, msg: 'This will free up the items you reserved.', yes: 'Yes, cancel it' })
    if (!ok) return
    const ct = loadTokens().find((x) => x.id === o.id)?.t || ''
    try {
      await api('/api/orders/cancel', { method: 'POST', body: { id: o.id, clientToken: ct } })
      toast('Order cancelled', 'ok')
      loadMine(); loadMenu()
    } catch (e: any) { toast(e.message, 'bad') }
  }

  async function switchUser() {
    const ok = await confirmBox({ title: 'Switch user?', msg: 'Your cart will be remembered on this device.', yes: 'Switch', danger: false })
    if (!ok) return
    localStorage.removeItem('fc.role')
    router.push('/')
  }

  /* ---------- render helpers ---------- */
  const filtered = items.filter(
    (i) => i.available !== false && (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase()))
  )
  const activeN = mine.filter((o) => o.status === 'placed').length

  if (!section) return <div className="root" />

  return (
    <div className="root">
      <header className="topbar">
        <div className="sec-chip">{section === 'boys' ? '👦' : '👧'}</div>
        <div className="titles">
          <h1>Syllabites</h1>
          <div className="sub">{section === 'boys' ? 'Boys' : 'Girls'} side · Order from your phone</div>
        </div>
        <button className="icon-btn" onClick={() => setTab('orders')} aria-label="My orders">
          🧾{activeN > 0 && <span className="dot-badge">{activeN}</span>}
        </button>
        <button className="icon-btn" onClick={switchUser} aria-label="Switch user">🚪</button>
      </header>

      <div className="scroll">
        <div style={{ display: tab === 'menu' ? '' : 'none' }}>
          <div className="search-wrap">
            <span className="s-ico">🔎</span>
            <input type="text" placeholder="Search food…" value={q}
              onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </div>
          <div className="chips-row">
            {cats.map((c) => (
              <button key={c} className={`chip${c === cat ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="divider-label">Menu</div>
          <div className="menu-list">
            {!loaded ? (
              <>
                <div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" />
              </>
            ) : filtered.length === 0 ? (
              <div className="empty">
                <span className="e-ico">{q || cat !== 'All' ? '🔍' : '🍳'}</span>
                <h3>{q || cat !== 'All' ? 'Nothing found' : 'Menu coming soon'}</h3>
                <p>{q || cat !== 'All' ? <>Try a different search or category.</> : <>The kitchen hasn&apos;t added any items yet.<br />Check back in a bit!</>}</p>
              </div>
            ) : filtered.map((it) => {
              const inCart = cart[String(it.id)] || 0
              return (
                <div key={it.id} className={`item-row${it.stock === 0 || !it.available ? ' out' : ''}`}>
                  <div className="emoji-tile">{it.emoji}</div>
                  <div className="item-info">
                    <div className="item-name">{it.name}</div>
                    <div className="item-cat">{it.category}</div>
                    <div className="item-price">{inr(it.price)}</div>
                    {it.stock === 0 ? <div className="stock-note out">Out of stock</div>
                      : it.stock <= 5 ? <div className="stock-note low">Only {it.stock} left!</div>
                      : <div className="stock-note ok">{it.stock} available</div>}
                  </div>
                  {inCart > 0 ? (
                    <div className="stepper">
                      <button onClick={() => addToCart(it.id, -1)}>{inCart <= 1 ? '🗑️' : '−'}</button>
                      <span className="qty-val">{inCart}</span>
                      <button disabled={inCart >= it.stock} onClick={() => addToCart(it.id, +1)}>+</button>
                    </div>
                  ) : (
                    <button className="add-btn" disabled={it.stock === 0} onClick={() => addToCart(it.id, +1)}>ADD +</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: tab === 'orders' ? '' : 'none' }}>
          {mine.length === 0 ? (
            <div className="empty">
              <span className="e-ico">🧾</span>
              <h3>No orders yet</h3>
              <p>Food you send will appear here<br />with its order code.</p>
              <button className="btn btn-primary" onClick={() => setTab('menu')}>Browse menu 🍜</button>
            </div>
          ) : (
            mine.map((o) => (
              <div key={o.id} className={`order-card${o.status === 'placed' ? ' enter' : ''}`} style={{ marginBottom: 12 }}>
                <div className="order-head">
                  <div className="token-chip"
                    style={o.status === 'completed' ? { background: 'linear-gradient(135deg,#22c55e,#15803d)' } : o.status === 'cancelled' ? { background: 'var(--bad)' } : undefined}>
                    <span className="tk-lbl">ORDER</span><span className="tk-no">{ordNo(o)}</span>
                  </div>
                  <div className="order-title">
                    <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                    <div className="order-time" style={{ marginTop: 3 }}>
                      {timeAgo(o.createdAt)} · {clockTime(o.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="order-items">
                  {o.items.map((li, ix) => (
                    <div key={ix} className="oi-line">
                      <span className="oi-qty">{li.qty}×</span>
                      <span>{li.emoji || ''} {li.name}</span>
                      <span className="oi-dots" />
                      <span className="oi-amt">{inr(li.lineTotal)}</span>
                    </div>
                  ))}
                </div>
                {o.status === 'completed' && (
                  <div style={{ background: 'var(--ok-tint)', color: 'var(--ok)', borderRadius: 12, padding: '9px 12px', fontSize: 12.5, fontWeight: 800, marginTop: 11 }}>
                    ✓ Served — enjoy your food!
                  </div>
                )}
                {o.status === 'cancelled' && (
                  <div style={{ background: 'var(--bad-tint)', color: 'var(--bad)', borderRadius: 12, padding: '9px 12px', fontSize: 12.5, fontWeight: 800, marginTop: 11 }}>
                    Cancelled · nothing charged
                  </div>
                )}
                <div className="order-foot">
                  <div className="order-total">Total<b>{inr(o.total)}</b></div>
                  {o.status === 'placed' && (
                    <button className="btn sm soft-bad" onClick={() => cancelOrder(o)}>Cancel</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={`cart-bar${totals.count > 0 && tab === 'menu' ? ' show' : ''}`}>
        <div className="cb-txt">
          <div className="cb-count">{totals.count} {totals.count === 1 ? 'item ready' : 'items ready'}</div>
          <div className="cb-total">{inr(totals.totalP)}</div>
        </div>
        <button className="go" disabled={sending} onClick={sendOrder}>{sending ? 'Sending…' : 'Send ➤'}</button>
      </div>

      <nav className="bottomnav">
        <button className={`nav-tab${tab === 'menu' ? ' on' : ''}`} onClick={() => setTab('menu')}>
          <span className="ico">🍜</span>Menu
        </button>
        <button className={`nav-tab${tab === 'orders' ? ' on' : ''}`} onClick={() => setTab('orders')}>
          <span className="ico">🧾</span>My Orders
          {activeN > 0 && <span className="tab-badge">{activeN}</span>}
        </button>
      </nav>
    </div>
  )
}
