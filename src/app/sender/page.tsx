'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db, fetchMenu } from '@/lib/db'
import { api } from '@/lib/client'
import { inr, ordNo, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import type { MenuItem, Order } from '@/lib/fmt'
import { toast, buzz, chime, confirmBox, useOnline, every, lockGate } from '@/lib/ui'
import { startDeviceHeartbeat } from '@/lib/device'
import { IconMenu, IconReceipt, IconSearch, IconDoor, IconBox, IconTrash, IconCheck, IconLock } from '@/components/icons'

type Cart = Record<string, number>

export default function SenderPage() {
  const router = useRouter()
  const online = useOnline()
  const [section, setSection] = useState<'boys' | 'girls' | null>(null)
  const [tab, setTab] = useState<'menu' | 'orders'>('menu')
  const [items, setItems] = useState<MenuItem[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [mine, setMine] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [ordersLoaded, setOrdersLoaded] = useState(false)
  const [sending, setSending] = useState(false)
  const [justSent, setJustSent] = useState<Order | null>(null)
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
      const list: MenuItem[] = await fetchMenu('items')
      setItems(list)
      setCats(['All', ...Array.from(new Set(list.map((i) => i.category)))])
    } catch {}
  }, [])

  const loadMine = useCallback(async () => {
    const toks = loadTokens().map((x) => x.t)
    if (!toks.length) { setMine([]); setOrdersLoaded(true); return }
    try {
      const res = await api<{ length: number }>('/api/orders/mine', { method: 'POST', body: { tokens: toks } })
      setMine(Array.isArray(res) ? (res as unknown as Order[]) : [])
    } catch {} finally {
      setOrdersLoaded(true)
    }
  }, [loadTokens])

  useEffect(() => {
    if (!section) return
    setCart(JSON.parse(localStorage.getItem(`fc.cart.${section}`) || '{}'))
    tokensRef.current = loadTokens()
    Promise.all([loadMenu(), loadMine()]).then(() => setLoaded(true))
    const hb = startDeviceHeartbeat(section, 'sender')
    // safety-net sync every 8s (covers missed live events, jittered per device)
    const stopPoll = every(8000, () => { loadMenu(); loadMine() })
    return () => { hb(); stopPoll() }
  }, [section, loadMenu, loadMine, loadTokens])

  /* clamp cart to reality whenever menu loads */
  useEffect(() => {
    if (!items.length || !section) return
    let changed = false
    const next = { ...cart }
    for (const id of Object.keys(next)) {
      const it = items.find((x) => String(x.id) === id)
      if (!it || !it.available || it.stock === 0) { delete next[id]; changed = true }
      else if (next[id] > it.stock || next[id] > 50) { next[id] = Math.min(it.stock, 50); changed = true }
    }
    if (changed) { setCart(next); localStorage.setItem(`fc.cart.${section}`, JSON.stringify(next)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  /* ---------- realtime ---------- */
  useEffect(() => {
    if (!section) return
    const ch = db()
      .channel('sender-' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => loadMine())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => loadMenu())
      .subscribe()
    return () => { db().removeChannel(ch) }
  }, [section, loadMenu, loadMine])

  /* ---------- cart ops, max 50 per item for Boys/Girls counters ---------- */
  function addToCart(id: number, delta: number) {
    const it = items.find((x) => x.id === id)
    if (!it || !it.available || !section) return
    const cur = cart[String(id)] || 0
    const nxt = cur + delta
    if (nxt > 50) { toast('Contanct The volunteers for high quantities', 'bad', 3400); return }
    if (nxt > it.stock) { toast(it.stock === 0 ? `"${it.name}" is out of stock` : `Only ${it.stock} left of "${it.name}"`, 'bad'); return }
    const next = { ...cart }
    let v = Math.max(0, nxt)
    if (v === 0) delete next[String(id)]; else next[String(id)] = v
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
      setJustSent(order)
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

  /* The Welcome hub only renders while the gate is locked, so going
     there re-locks this device. Section, role, cart and tokens stay. */
  function goWelcome() {
    buzz(10)
    lockGate()
    router.push('/')
  }

  /* ---------- render helpers ---------- */
  const filtered = useMemo(
    () => items.filter(
      (i) => i.available !== false && (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase()))
    ),
    [items, cat, q]
  )
  const activeN = mine.filter((o) => o.status === 'placed').length

  if (!section) return <div className="root" />

  return (
    <div className="root">
      <header className="topbar">
        <div className="sec-chip" aria-hidden="true">{section === 'boys' ? 'B' : 'G'}</div>
        <div className="titles">
          <h1>Syllabites</h1>
          <div className="sub">{section === 'boys' ? 'Boys' : 'Girls'} side · Order from your phone</div>
        </div>
        <button className="icon-btn" onClick={() => setTab('orders')} aria-label="My orders">
          <IconReceipt size={20} />{activeN > 0 && <span className="dot-badge">{activeN}</span>}
        </button>
        <button className="icon-btn" onClick={goWelcome} aria-label="Go to Welcome page"><IconLock size={18} /></button>
        <button className="icon-btn" onClick={switchUser} aria-label="Switch user"><IconDoor size={19} /></button>
      </header>

      <div className="scroll stack">
        <div style={{ display: tab === 'menu' ? '' : 'none' }}>
          <div className="search-wrap">
            <span className="s-ico"><IconSearch size={17} /></span>
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
                <span className="e-ico" aria-hidden="true">{q || cat !== 'All' ? <IconSearch size={24} /> : <IconBox size={24} />}</span>
                <h3>{q || cat !== 'All' ? 'Nothing found' : 'Menu coming soon'}</h3>
                <p>{q || cat !== 'All' ? <>Try a different search or category.</> : <>The kitchen hasn&apos;t added any items yet.<br />Check back in a bit!</>}</p>
              </div>
            ) : filtered.map((it) => {
              const inCart = cart[String(it.id)] || 0
              return (
                <div key={it.id} className={`item-row${it.stock === 0 || !it.available ? ' out' : ''}`}>
                  <div className="emoji-tile" role="img" aria-label={it.name}>{it.emoji}</div>
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
                      <button onClick={() => addToCart(it.id, -1)} aria-label={inCart <= 1 ? 'Remove from cart' : 'Decrease quantity'}>{inCart <= 1 ? <IconTrash size={15} /> : '−'}</button>
                      <span className="qty-val">{inCart}</span>
                      <button disabled={inCart >= 50 || inCart >= it.stock} onClick={() => addToCart(it.id, +1)}>+</button>
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
          {!ordersLoaded ? (
            <>
              <div className="skel skel-row" /><div className="skel skel-row" />
            </>
          ) : mine.length === 0 ? (
            <div className="empty">
              <span className="e-ico" aria-hidden="true"><IconReceipt size={24} /></span>
              <h3>No orders yet</h3>
              <p>Food you send will appear here<br />with its order code.</p>
              <button className="btn btn-primary" onClick={() => setTab('menu')}>Browse menu</button>
            </div>
          ) : (
            mine.map((o) => (
              <div key={o.id} className={`order-card${o.status === 'placed' ? ' enter' : ''}`} style={{ marginBottom: 12 }}>
                <div className="order-head">
                  <div className="token-chip"
                    style={o.status === 'completed' ? { background: 'var(--ok)' } : o.status === 'cancelled' ? { background: 'var(--bad)' } : undefined}>
                    <span className="tk-lbl">ORDER</span><span className="tk-no">{ordNo(o)}</span>
                  </div>
                  <div className="order-title">
                    <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                    <div className="order-time" style={{ marginTop: 3 }}>
                      {timeAgo(o.createdAt)} · {clockTime(o.createdAt)}
                    </div>
                  </div>
                </div>
                <div className="track" aria-label={`Order status: ${statusPill(o.status)}`}>
                  <span className={`seg ${o.status === 'placed' || o.status === 'completed' ? 'done' : ''}`} />
                  <span className={`seg ${o.status === 'completed' ? 'done' : o.status === 'placed' ? 'active' : ''}`} />
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
                    Served — enjoy your food.
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
        <button className="go" disabled={sending || !online} title={!online ? "Can't reach the server, check your internet connection" : undefined} onClick={sendOrder}>{sending ? 'Sending…' : 'Send order'}</button>
      </div>
      {!online && totals.count > 0 && tab === 'menu' && (
        <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'calc(var(--nav-h) + var(--sab) + 76px)', zIndex: 15, textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--bad)' }}>
          Can&apos;t reach the server. Check your internet connection.
        </div>
      )}

      <nav className="bottomnav">
        <button className={`nav-tab${tab === 'menu' ? ' on' : ''}`} onClick={() => setTab('menu')}>
          <span className="ico"><IconMenu size={22} /></span>Menu
        </button>
        <button className={`nav-tab${tab === 'orders' ? ' on' : ''}`} onClick={() => setTab('orders')}>
          <span className="ico"><IconReceipt size={22} /></span>My Orders
          {activeN > 0 && <span className="tab-badge">{activeN}</span>}
        </button>
      </nav>

      {justSent && (
        <div className="success-wrap" role="alertdialog" aria-label="Order confirmed">
          <div className="success-card">
            <div className="check-circle"><span><IconCheck size={30} /></span></div>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginTop: 14 }}>Order sent!</h2>
            <div className="success-token">{ordNo(justSent)}</div>
            <p className="success-sub">
              Show this number at the counter to collect your food.
              <br />
              {inr(justSent.total)} · {justSent.items.reduce((a, li) => a + li.qty, 0)} items
            </p>
            <div style={{ display: 'flex', gap: 9, marginTop: 18 }}>
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setJustSent(null); setTab('menu') }}>
                Back to menu
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { setJustSent(null); setTab('orders') }}>
                Track order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
