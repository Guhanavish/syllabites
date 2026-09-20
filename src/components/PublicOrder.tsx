'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { db, fetchMenu } from '@/lib/db'
import { inr } from '@/lib/fmt'
import { toast, buzz, chime, useOnline, every } from '@/lib/ui'
import type { MenuItem } from '@/lib/fmt'
import { IconSearch, IconBox, IconTrash, IconCheck } from '@/components/icons'

function DetailField({ label, hint, error, id, ...props }: {
  label: string
  hint: string
  error: string
  id: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : `${id}-hint`}
        style={error ? { borderColor: 'var(--bad)' } : undefined}
      />
      {error ? (
        <div id={`${id}-err`} role="alert" style={{ fontSize: 11.5, color: 'var(--bad)', fontWeight: 700, marginTop: 4 }}>{error}</div>
      ) : (
        <div id={`${id}-hint`} style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>{hint}</div>
      )}
    </div>
  )
}

type Cart = Record<string, number>
type Placed = { id: number; code: string; total: number; originalTotal?: number; discountPercent?: number; discountAmount?: number; isDiscounted?: boolean; items: { name: string; emoji: string; qty: number; lineTotal: number }[] }

export function PublicOrder() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [cats, setCats] = useState<string[]>([])
  const [cat, setCat] = useState('All')
  const [q, setQ] = useState('')
  const [cart, setCart] = useState<Cart>({})
  const [sending, setSending] = useState(false)
  const [placed, setPlaced] = useState<Placed | null>(null)
  const [name, setName] = useState('')
  const [klass, setKlass] = useState('')
  const [section, setSection] = useState('')
  const [eventName, setEventName] = useState('')
  const [tried, setTried] = useState(false)
  const [menuLoaded, setMenuLoaded] = useState(false)
  const [menuError, setMenuError] = useState('')
  // Honeypot: real users never see or fill this; bots often do.
  const [company, setCompany] = useState('')
  const online = useOnline()

  const loadMenu = useCallback(async () => {
    try {
      // Parcel menu is separate storage (parcel_items), staff items never leak here
      const list = await fetchMenu('parcel_items')
      setItems(list)
      setCats(['All', ...Array.from(new Set(list.map((i) => i.category).filter((c) => c && c.trim() !== '')))])
      setMenuLoaded(true)
      setMenuError('')
    } catch {
      setMenuLoaded(true)
      setMenuError("Can't reach the server. Check your internet connection.")
    }
  }, [])

  useEffect(() => { loadMenu() }, [loadMenu])
  useEffect(() => { const stop = every(12000, () => loadMenu()); return () => stop() }, [loadMenu])

  // realtime primary for parcel menu; polling above is the fallback
  useEffect(() => {
    const ch = db()
      .channel('parcel-menu-' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parcel_items' }, () => loadMenu())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_orders' }, () => loadMenu())
      .subscribe()
    return () => { db().removeChannel(ch) }
  }, [loadMenu])

  function addToCart(id: number, delta: number) {
    // Public orders carry no stock limit: any quantity goes through.
    const it = items.find((x) => x.id === id)
    if (!it || it.available === false) return
    const cur = cart[String(id)] || 0
    const next = cur + delta
    if (next <= 0) { const n = { ...cart }; delete n[String(id)]; setCart(n); buzz(8); return }
    buzz(8)
    setCart({ ...cart, [String(id)]: next })
  }

  const filtered = useMemo(
    () => items.filter(i => i.available !== false && (cat === 'All' || i.category === cat) && (!q || i.name.toLowerCase().includes(q.toLowerCase()))),
    [items, cat, q]
  )
  const totals = Object.entries(cart).reduce((a, [id, qty]) => {
    const it = items.find(x => x.id === Number(id)); if (!it) return a
    return { count: a.count + qty, totalP: a.totalP + it.price * qty }
  }, { count: 0, totalP: 0 })

  const missing = {
    name: !name.trim() ? 'Please enter your name' : '',
    klass: !klass.trim() ? 'Please enter your class, e.g. 10-A' : '',
    section: !section.trim() ? 'Please enter your section, e.g. A' : '',
    eventName: !eventName.trim() ? 'Please enter the event you are attending' : '',
  }
  const detailsOk = !missing.name && !missing.klass && !missing.section && !missing.eventName

  async function place() {
    if (!totals.count || sending) return
    setTried(true)
    if (!detailsOk) {
      toast('Please fill Name, Class, Section and Event', 'bad'); return
    }
    setSending(true)
    try {
      const res = await fetch('/api/public/place', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: Object.entries(cart).map(([itemId, qty]) => ({ itemId: Number(itemId), qty })),
          name: name.trim(), klass: klass.trim(), section: section.trim(), eventName: eventName.trim(),
          company,
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not place order')
      setPlaced({ id: data.id, code: data.code, total: data.total, originalTotal: data.originalTotal, discountPercent: data.discountPercent, discountAmount: data.discountAmount, isDiscounted: data.isDiscounted, items: data.items })
      setCart({})
      chime(); buzz([30, 60, 30])
    } catch (e: any) {
      toast(e.message || 'Could not place order', 'bad', 3600); loadMenu()
    } finally { setSending(false) }
  }

  if (placed) {
    return (
      <div className="scroll" style={{ paddingBottom: 24 }}>
        {placed.isDiscounted && (
          <div style={{ background: 'var(--ink)', color: '#fff', borderRadius: 12, padding: '16px 14px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0 }}>Discount applied</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, opacity: .95 }}>{placed.discountPercent}% OFF, You saved {inr(placed.discountAmount || 0)}.</div>
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4, opacity: .9 }}>Original {inr(placed.originalTotal || 0)} → Now {inr(placed.total)}</div>
          </div>
        )}
        <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
          <div className="check-circle" style={{ margin: '0 auto' }}><span><IconCheck size={30} /></span></div>
          <h2 style={{ fontSize: 20, fontWeight: 900, marginTop: 14 }}>Order placed!</h2>
          <p style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13, marginTop: 6 }}>Show this code at the counter.<br />Only you see it here.</p>
        </div>
        <div className="card pad" style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: 'var(--muted)' }}>YOUR CODE</div>
          <div style={{ fontSize: 42, fontWeight: 900, letterSpacing: '.18em', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{placed.code}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginTop: 8 }}>
            {placed.isDiscounted ? (
              <><span style={{ textDecoration: 'line-through', opacity: .7 }}>{inr(placed.originalTotal || 0)}</span>{' → '}<span style={{ color: 'var(--ok)', fontWeight: 900 }}>{inr(placed.total)}</span>{' · '}{placed.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</>
            ) : (
              <>{inr(placed.total)} · {placed.items.map(i => `${i.qty}× ${i.name}`).join(', ')}</>
            )}
          </div>
        </div>
        <button className="btn btn-primary xl block" style={{ marginTop: 18 }} onClick={() => setPlaced(null)}>Place another order</button>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 11, fontWeight: 600, marginTop: 10 }}>Keep this code safe, it will not be shown again.</p>
      </div>
    )
  }

  return (
    <>
      <div className="card pad" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>Your details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <DetailField id="po-name" label="Name" hint="Your full name" error={tried ? missing.name : ''} type="text" placeholder="e.g. Arjun" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" />
          <DetailField id="po-klass" label="Class" hint="e.g. 10-A" error={tried ? missing.klass : ''} type="text" placeholder="e.g. 10-A" value={klass} onChange={e=>setKlass(e.target.value)} autoComplete="off" />
          <DetailField id="po-section" label="Section" hint="e.g. A" error={tried ? missing.section : ''} type="text" placeholder="e.g. A" value={section} onChange={e=>setSection(e.target.value)} autoComplete="off" />
          <DetailField id="po-event" label="Event participating" hint="Event you came for" error={tried ? missing.eventName : ''} type="text" placeholder="e.g. Science Expo" value={eventName} onChange={e=>setEventName(e.target.value)} autoComplete="off" />
        </div>
        {/* Honeypot field for bots. Hidden from sighted users and screen readers. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: -9999, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
          <input type="text" name="company" tabIndex={-1} autoComplete="off" value={company} onChange={e=>setCompany(e.target.value)} />
        </div>
      </div>

      <div className="search-wrap"><span className="s-ico"><IconSearch size={17} /></span>
        <input type="text" placeholder="Search food…" value={q} onChange={e => setQ(e.target.value)} autoComplete="off" />
      </div>
      <div className="chips-row" style={{ marginTop: 10 }}>
        {cats.map(c => <button key={c} className={`chip${c === cat ? ' on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="divider-label">Menu</div>
      <div className="menu-list" style={{ paddingBottom: totals.count ? 90 : 0 }}>
        {!menuLoaded ? (
          <>
            <div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" />
          </>
        ) : menuError && filtered.length === 0 ? (
          <div className="empty"><span className="e-ico" aria-hidden="true"><IconSearch size={24} /></span><h3>Connection issue</h3><p>{menuError}</p><button className="btn btn-primary" onClick={() => loadMenu()}>Try again</button></div>
        ) : filtered.length === 0 ? (
          <div className="empty"><span className="e-ico" aria-hidden="true"><IconBox size={24} /></span><h3>Menu coming soon</h3><p>Kitchen will add items shortly.</p></div>
        ) : filtered.map(it => {
          const inCart = cart[String(it.id)] || 0
          return (
            <div key={it.id} className={`item-row enter${it.available === false ? ' out' : ''}`} style={{ animationDelay: '0s' }}>
              <div className="emoji-tile" role="img" aria-label={it.name}>{it.emoji}</div>
              <div className="item-info">
                <div className="item-name">{it.name}</div>
                <div className="item-cat">{it.category}</div>
                <div className="item-price">{inr(it.price)}</div>
                {it.available === false && <div className="stock-note out">Currently unavailable</div>}
              </div>
              {inCart > 0 ? (
                <div className="stepper">
                  <button onClick={() => addToCart(it.id, -1)} aria-label={inCart <= 1 ? 'Remove from cart' : 'Decrease quantity'}>{inCart <= 1 ? <IconTrash size={15} /> : '−'}</button>
                  <span className="qty-val">{inCart}</span>
                  <button onClick={() => addToCart(it.id, 1)} aria-label="Increase quantity">+</button>
                </div>
              ) : (
                <button className="add-btn" disabled={it.available === false} onClick={() => addToCart(it.id, 1)}>ADD +</button>
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
        <button className="go" disabled={sending || !online} title={!online ? "Can't reach the server, check your internet connection" : undefined} onClick={place}>{sending ? 'Placing…' : 'Place order'}</button>
      </div>
      {!online && totals.count > 0 && (
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 800, color: 'var(--bad)', paddingBottom: 90 }}>
          Can&apos;t reach the server. Check your internet connection.
        </div>
      )}
    </>
  )
}
