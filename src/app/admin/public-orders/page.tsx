'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client'
import { inr, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import { toast } from '@/lib/ui'

export default function PublicOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>('/api/public/admin-list')
      setOrders(Array.isArray(data) ? data : [])
    } catch {}
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

  return (
    <div className="root">
      <header className="topbar">
        <a href="/admin" className="icon-btn" style={{ textDecoration: 'none' }}>←</a>
        <div className="titles"><h1>Public Orders</h1><div className="sub">Organized view — entrance orders (6-digit codes)</div></div>
        <button className="icon-btn" onClick={load}>↻</button>
      </header>

      <div className="scroll">
        <div className="search-wrap"><span className="s-ico">🔎</span>
          <input type="text" placeholder="Search code, name, class, event…" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div className="chips-row" style={{ marginTop: 10 }}>
          {['all','placed','completed','cancelled'].map(s=>(
            <button key={s} className={`chip${filter===s?' on':''}`} onClick={()=>setFilter(s)}>{s}</button>
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
              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--warn)' }}>Report — discounted orders:</div>
              {discounted.map((o:any)=>(
                <div key={o.id} style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>{o.code} — {o.customerName} · {o.discountPercent}% off · saved {inr(o.discountAmount)} (orig {inr(o.originalTotal)} → {inr(o.total)})</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          {!filtered.length ? (
            <div className="empty"><span className="e-ico">🎟️</span><h3>No orders</h3><p>Public orders placed at the entrance appear here.</p></div>
          ) : filtered.map((o:any)=>(
            <div key={o.id} className="order-card enter" style={{ marginBottom: 12 }}>
              <div className="order-head">
                <div className="token-chip"><span className="tk-lbl">CODE</span><span className="tk-no">{o.code}</span></div>
                <div className="order-title">
                  <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                  <div className="order-time" style={{ marginTop: 3 }}>{timeAgo(o.createdAt)} · {clockTime(o.createdAt)}</div>
                </div>
                <span className="badge-pill" style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }}>{inr(o.total)}</span>
              </div>
              <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: '10px 12px', marginTop: 10, fontSize: 12, fontWeight: 600 }}>
                <div><b>Name:</b> {o.customerName} · <b>Class:</b> {o.customerClass} · <b>Section:</b> {o.customerSection} · <b>Event:</b> {o.eventName}</div>
                {o.isDiscounted && <div style={{ color: 'var(--ok)', fontWeight: 800, marginTop: 4 }}>🎉 {o.discountPercent}% OFF — saved {inr(o.discountAmount)} (orig {inr(o.originalTotal)})</div>}
              </div>
              <div className="order-items" style={{ marginTop: 10 }}>
                {o.items?.map((li:any,ix:number)=>(
                  <div key={ix} className="oi-line"><span className="oi-qty">{li.qty}×</span><span>{li.emoji||''} {li.name}</span><span className="oi-dots"/><span className="oi-amt">{inr(li.lineTotal)}</span></div>
                ))}
              </div>
              {o.status==='placed' && (
                <div className="order-actions" style={{ marginTop: 10 }}>
                  <button className="btn ok" onClick={()=>updateStatus(o,'completed')}>✓ Served</button>
                  <button className="btn sm soft-bad" onClick={()=>updateStatus(o,'cancelled')}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
