'use client'

import { useCallback, useEffect, useState } from 'react'
import { sb } from '@/lib/supabase'
import { inr } from '@/lib/fmt'
import { toast, buzz, chime } from '@/lib/ui'
import type { MenuItem } from '@/lib/fmt'

type Cart = Record<string, number>

type Placed = { id: number; code: string; total: number; items: { name: string; emoji: string; qty: number; lineTotal: number }[] }

export function PublicOrder() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [sending, setSending] = useState(false)
  const [placed, setPlaced] = useState<Placed | null>(null)

  const loadMenu = useCallback(async () => {
    try {
      const { data } = await sb().from('items').select('*').order('id')
      const list = (data || []) as any[]
      setItems(list)
      setCats(['All', ...Array.from(new Set(list.map((i) => i.category)))])
    } catch {}
  }, [])

  useEffect(() => { loadMenu() }, [loadMenu])
  // keep stock fresh without blocking UI (poll lightly, realtime is primary for admin but not needed here)
  useEffect(() => {
    const t = setInterval(loadMenu, 12000)
    return () => clearInterval(t)
  }, [loadMenu])

  function addToCart(id: number, delta: number) {
    const it = items.find((x) => x.id === id)
    if (!it) return
    const cur = cart[String(id)] || 0
    const next = cur + delta
    if (next > 10) {
      toast('Contanct The volunteers for hight quantities', 'bad', 3400)
      return
    }
    if (next <= 0) {
      const n = { ...cart }; delete n[String(id)]; setCart(n); buzz(8); return
    }
    if (next > it.stock) {
      toast(it.stock === 0 ? `"${it.name}" is out of stock` : `Only ${it.stock} left of "${it.name}"`, 'bad')
      return
    }
    buzz(8)
    setCart({ ...cart, [String(id)]: next })
  }

  const filtered = items.filter(i => i.available !== false && (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase())))
  const totals = Object.entries(cart).reduce((a, [id, qty]) => {
    const it = items.find(x => x.id === Number(id)); if (!it) return a
    return { count: a.count + qty, totalP: a.totalP + it.price * qty }
  }, { count: 0, totalP: 0 })

  async function place() {
    if (!totals.count || sending) return
    // final client guard: any line >10 already blocked, but double-check
    for (const qty of Object.values(cart)) if ((qty as number) > 10) { toast('Contanct The volunteers for hight quantities', 'bad'); return }
    setSending(true)
    try {
      const res = await fetch('/api/public/place', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: Object.entries(cart).map(([itemId, qty]) => ({ itemId: Number(itemId), qty })) })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not place order')
      setPlaced({ id: data.id, code: data.code, total: data.total, items: data.items })
      setCart({})
      chime(); buzz([30, 60, 30])
    } catch (e: any) {
      toast(e.message || 'Could not place order', 'bad', 3600)
      loadMenu()
    } finally { setSending(false) }
  }

  // success view - code shown only here, never in list/history
  if (placed) {
    return (
      <div className="scroll" style={{ paddingBottom: 24 }}>
        <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
          <div className="check-circle" style={{ margin: '0 auto' }}><span>✓</span></div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginTop: 14 }}>Order placed!</h2>
          <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13, marginTop: 6 }}>
            Show this code at the counter.
            <br />Only you see it here.
          </p>
        </div>
        <div className="card pad" style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: 'var(--muted)' }}>YOUR CODE</div>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '.18em', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{placed.code}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginTop: 8 }}>{inr(placed.total)} · {placed.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</div>
        </div>
        <button className="btn btn-primary xl block" style={{ marginTop: 18 }} onClick={() => setPlaced(null)}>Place another order</button>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, fontWeight: 600, marginTop: 10 }}>
          Keep this code safe — it will not be shown again.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="search-wrap"><span className="s-ico">🔎</span>
        <input type="text" placeholder="Search food…" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" />
      </div>
      <div className="chips-row" style={{ marginTop: 10 }}>
        {cats.map(c => <button key={c} className={`chip${c === cat ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="divider-label">Menu</div>
      <div className="menu-list" style={{ paddingBottom: totals.count ? 90 : 0 }}>
        {filtered.length === 0 ? (
          <div className="empty"><span className="e-ico">🍳</span><h3>Menu coming soon</h3><p>Kitchen will add items shortly.</p></div>
        ) : filtered.map(it => {
          const inCart = cart[String(it.id)] || 0
          return (
            <div key={it.id} className={`item-row enter${it.stock === 0 ? ' out' : ''}`} style={{ animationDelay: '0s' }}>
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
                  <button disabled={inCart >= 10 || inCart >= it.stock} onClick={() => addToCart(it.id, 1)}>+</button>
                </div>
              ) : (
                <button className="add-btn" disabled={it.stock === 0} onClick={() => addToCart(it.id, 1)}>ADD +</button>
              )}
            </div>
          )
        })}
      </div>

      <div className={`cart-bar${totals.count > 0 ? ' show' : ''}`}>
        <div className="cb-txt">
          <div className="cb-count">{totals.count} {totals.count === 1 ? 'item ready' : 'items ready'}</div>
          <div className="cb-total">{inr(totals.totalP)}</div>
        </div>
        <button className="go" disabled={sending} onClick={place}>{sending ? 'Placing…' : 'Place order ➤'}</button>
      </div>
    </>
  )
}
