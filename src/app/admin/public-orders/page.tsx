'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '@/lib/client'
import { inr, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import { toast } from '@/lib/ui'
import { Crumbs } from '@/components/site-chrome'
import { IconSearch, IconBack, IconRefresh, IconReceipt } from '@/components/icons'

type PORow = {
  id: number
  code: string
  status: string
  customerName: string
  customerClass: string
  customerSection: string
  eventName: string
  createdAt: string
  total: number
  isDiscounted?: boolean
  discountPercent?: number
  discountAmount?: number
  originalTotal?: number
  items?: { qty: number; name: string; lineTotal: number }[]
}

export default function PublicOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(15)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>('/api/public/admin-list')
      setOrders(Array.isArray(data) ? data : [])
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function updateStatus(o: any, status: string) {
    try {
      await api('/api/public/admin-status', { method: 'POST', body: { id: o.id, status } })
      load()
      toast(status === 'completed' ? 'Marked as served' : 'Cancelled', 'ok')
    } catch (e: any) { toast(e.message, 'bad') }
  }

  const filtered = orders.filter(o => {
    if (filter !== 'all' && o.status !== filter) return false
    if (!q) return true
    const s = `${o.code} ${o.customerName} ${o.customerClass} ${o.customerSection} ${o.eventName}`.toLowerCase()
    return s.includes(q.toLowerCase())
  })

  const discounted = orders.filter((o:any)=>o.isDiscounted)
  const totalDiscounted = discounted.reduce((a:number,o:any)=>a+(o.discountAmount||0),0)

  /* PDF selection: only ticked orders print. Selection survives filtering. */
  function toggleSel(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAllFiltered() {
    const ids = filtered.map((o: PORow) => o.id)
    const all = ids.length > 0 && ids.every((id: number) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      if (all) ids.forEach((id: number) => next.delete(id))
      else ids.forEach((id: number) => next.add(id))
      return next
    })
  }
  const selOrders: PORow[] = orders.filter((o: PORow) => selected.has(o.id))
  const generatedAt = new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

  return (
    <div className="root">
      <header className="topbar">
        <a href="/admin" className="icon-btn" style={{ textDecoration: 'none' }} aria-label="Back to admin"><IconBack size={18} /></a>
        <div className="titles"><h1>Public Orders</h1><div className="sub">Organized view of entrance orders (6-digit codes)</div></div>
        <button className="icon-btn" onClick={load} aria-label="Refresh"><IconRefresh size={17} /></button>
      </header>

      <div className="scroll">
        <Crumbs trail={[{ label: 'Admin', href: '/admin' }, { label: 'Public Orders' }]} />
        <div className="search-wrap"><span className="s-ico"><IconSearch size={17} /></span>
          <input type="text" placeholder="Search code, name, class, event…" value={q} onChange={e=>{setQ(e.target.value); setVisible(15)}} />
        </div>
        <div className="chips-row" style={{ marginTop: 10 }}>
          {['all','placed','completed','cancelled'].map(s=>(
            <button key={s} className={`chip${filter===s?' on':''}`} onClick={()=>{setFilter(s); setVisible(15)}}>{s}</button>
          ))}
        </div>

        <div className="card pad" style={{ marginTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 900 }}>Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
            <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900 }}>{orders.length}</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Total</div></div>
            <div style={{ background: 'var(--ok-tint)', borderRadius: 12, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ok)' }}>{discounted.length}</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ok)' }}>Discounted</div></div>
            <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: 10, textAlign: 'center' }}><div style={{ fontSize: 20, fontWeight: 900 }}>{inr(totalDiscounted)}</div><div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Total saved</div></div>
          </div>
          {discounted.length > 0 && (
            <div style={{ marginTop: 12, background: 'var(--warn-tint)', borderRadius: 12, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--warn)' }}>Discounted orders report:</div>
              {discounted.map((o:any)=>(
                <div key={o.id} style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{o.code}, {o.customerName} · {o.discountPercent}% off · saved {inr(o.discountAmount)} (orig {inr(o.originalTotal)} → {inr(o.total)})</div>
              ))}
            </div>
          )}
        </div>

        <div className="card pad sel-toolbar" style={{ marginTop: 14 }}>
          <label className="sel-all">
            <input
              type="checkbox"
              className="order-select"
              checked={filtered.length > 0 && filtered.every((o: PORow) => selected.has(o.id))}
              onChange={toggleAllFiltered}
              aria-label="Select all visible orders for PDF"
            />
            <span>Select all</span>
          </label>
          <span className="sel-count">{selected.size} selected</span>
          <span style={{ flex: 1 }} />
          {selected.size > 0 && (
            <button className="btn btn-ghost sm" onClick={() => setSelected(new Set())}>Clear</button>
          )}
          <button className="btn btn-primary sm" disabled={selected.size === 0} onClick={() => window.print()}>
            PDF{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

        <div style={{ marginTop: 14 }}>
          {loading ? (
            <>
              <div className="skel skel-row" /><div className="skel skel-row" />
            </>
          ) : !filtered.length ? (
            <div className="empty"><span className="e-ico" aria-hidden="true"><IconReceipt size={24} /></span><h3>No orders</h3><p>Public orders placed at the entrance appear here.</p></div>
          ) : (
            <>
              {filtered.slice(0, visible).map((o:any)=>(
            <div key={o.id} className="order-card enter" style={{ marginBottom: 12 }}>
              <div className="order-head">
                <input
                  type="checkbox"
                  className="order-select"
                  checked={selected.has(o.id)}
                  onChange={() => toggleSel(o.id)}
                  aria-label={`Select order ${o.code} for PDF`}
                />
                <div className="token-chip"><span className="tk-lbl">CODE</span><span className="tk-no">{o.code}</span></div>
                <div className="order-title">
                  <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                  <div className="order-time" style={{ marginTop: 3 }}>{timeAgo(o.createdAt)} · {clockTime(o.createdAt)}</div>
                </div>
                <span className="badge-pill" style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }}>{inr(o.total)}</span>
              </div>
              <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: '10px 12px', marginTop: 10, fontSize: 12, fontWeight: 600 }}>
                <div><b>Name:</b> {o.customerName} · <b>Class:</b> {o.customerClass} · <b>Section:</b> {o.customerSection} · <b>Event:</b> {o.eventName}</div>
                {o.isDiscounted && <div style={{ color: 'var(--ok)', fontWeight: 800, marginTop: 4 }}>{o.discountPercent}% OFF, saved {inr(o.discountAmount)} (orig {inr(o.originalTotal)})</div>}
              </div>
              <div className="order-items" style={{ marginTop: 10 }}>
                {o.items?.map((li:any,ix:number)=>(
                  <div key={ix} className="oi-line"><span className="oi-qty">{li.qty}×</span><span>{li.emoji||''} {li.name}</span><span className="oi-dots"/><span className="oi-amt">{inr(li.lineTotal)}</span></div>
                ))}
              </div>
              {o.status==='placed' && (
                <div className="order-actions" style={{ marginTop: 10 }}>
                  <button className="btn ok" onClick={()=>updateStatus(o,'completed')}>Mark served</button>
                  <button className="btn sm soft-bad" onClick={()=>updateStatus(o,'cancelled')}>Cancel</button>
                </div>
              )}
            </div>
          ))}
          {filtered.length > visible && (
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
                Showing {visible} of {filtered.length}
              </div>
              <button className="btn btn-ghost" onClick={()=>setVisible((v)=>v + 15)}>Show more</button>
            </div>
          )}
          </>
          )}
        </div>
      </div>
      {typeof document !== 'undefined' && createPortal(
        <div className="print-doc" aria-hidden="true">
          <h1>Syllabites — Order verification</h1>
          <p className="print-meta">Generated {generatedAt} · {selOrders.length} entrance order(s) · ticked orders only</p>
          {selOrders.map((o: PORow) => (
            <section key={o.id} className="print-order">
              <h2>Access code {o.code} — {statusPill(o.status)}</h2>
              <p>Name: {o.customerName} · Class: {o.customerClass} · Section: {o.customerSection} · Event: {o.eventName}</p>
              <p>Placed: {timeAgo(o.createdAt)} · {clockTime(o.createdAt)}</p>
              <table className="print-table">
                <thead><tr><th>Qty</th><th>Item</th><th>Amount</th></tr></thead>
                <tbody>
                  {o.items?.map((li: { qty: number; name: string; lineTotal: number }, ix: number) => (
                    <tr key={ix}><td>{li.qty}</td><td>{li.name}</td><td>{inr(li.lineTotal)}</td></tr>
                  ))}
                </tbody>
              </table>
              {o.isDiscounted ? (
                <p className="print-total">Original {inr(o.originalTotal)} · {o.discountPercent}% off, saved {inr(o.discountAmount)} · Total {inr(o.total)}</p>
              ) : (
                <p className="print-total">Total {inr(o.total)}</p>
              )}
            </section>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
