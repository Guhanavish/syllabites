'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client'
import { inr, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import { toast } from '@/lib/ui'
import type { Stats } from './types'

export function SalesTab({ expired }: { expired: (e: any) => boolean }) {
  const [range, setRange] = useState('today')
  const [s, setS] = useState<Stats | null>(null)

  const load = useCallback(async (r: string) => {
    try { setS(await api<Stats>('/api/stats?range=' + r)) } catch (e: any) { expired(e) }
  }, [expired])

  useEffect(() => { load(range) }, [range, load])
  useEffect(() => {
    const p = setInterval(() => load(range), 15000)
    return () => clearInterval(p)
  }, [range, load])

  if (!s) return <div><div className="skel skel-row" /><div className="skel skel-row" /></div>

  const b = s.sections?.boys || { revenue: 0, orders: 0 }
  const g = s.sections?.girls || { revenue: 0, orders: 0 }
  const totRev = b.revenue + g.revenue
  const bp = totRev > 0 ? Math.round((b.revenue / totRev) * 100) : 50
  const maxSold = Math.max(1, ...s.topItems.map((t) => t.sold))
  const avg = s.orders > 0 ? Math.round(s.revenue / s.orders) : 0
  const rangeLbl = { today: 'today', week: '7 days', all: 'all time' }[s.range] || ''
  const dev = s.devices || { boys: { sender: 0, receiver: 0, total: 0 }, girls: { sender: 0, receiver: 0, total: 0 }, total: 0 }
  const pubCount = (s as any).publicOrders ?? 0

  return (
    <>
      <div className="range-seg">
        {[['today', 'Today'], ['week', '7 days'], ['all', 'All time']].map(([v, l]) => (
          <button key={v} className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>
        ))}
      </div>
      <PublicOrdersCard />

      {/* Active devices — 4 fully individual counters */}
      <div className="card pad" style={{ marginBottom: 14, border: '1px solid var(--line)' }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>📱 Active devices (last 2 min) — each counter separate</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '10px 12px', textAlign: 'center', border: '1px solid #DBEAFE' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', letterSpacing: '.04em' }}>👦 BOYS · SENDER</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, color: '#1E3A8A' }}>{dev.boys.sender}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>ordering phones</div>
          </div>
          <div style={{ background: '#EFF6FF', borderRadius: 12, padding: '10px 12px', textAlign: 'center', border: '1px solid #BFDBFE' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', letterSpacing: '.04em' }}>👦 BOYS · RECEIVER</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, color: '#1E3A8A' }}>{dev.boys.receiver}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6' }}>counter screens</div>
          </div>
          <div style={{ background: '#FDF2F8', borderRadius: 12, padding: '10px 12px', textAlign: 'center', border: '1px solid #FBCFE8' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#BE185D', letterSpacing: '.04em' }}>👧 GIRLS · SENDER</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, color: '#831843' }}>{dev.girls.sender}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#EC4899' }}>ordering phones</div>
          </div>
          <div style={{ background: '#FDF2F8', borderRadius: 12, padding: '10px 12px', textAlign: 'center', border: '1px solid #F9A8D4' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#BE185D', letterSpacing: '.04em' }}>👧 GIRLS · RECEIVER</div>
            <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4, color: '#831843' }}>{dev.girls.receiver}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#EC4899' }}>counter screens</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>
          <span>👦 Boys total: {dev.boys.total}</span>
          <span>·</span>
          <span>👧 Girls total: {dev.girls.total}</span>
          <span>·</span>
          <span>All: {dev.total}</span>
        </div>
      </div>
      <div className="kpi-grid">
        <div className="kpi wide">
          <div className="k-lbl">💰 Total sales · {rangeLbl}</div>
          <div className="k-val">{inr(s.revenue)}</div>
          <div className="k-sub">{s.orders} order{s.orders === 1 ? '' : 's'}{avg ? ` · avg ${inr(avg)}` : ''}</div>
        </div>
        <div className="kpi"><div className="k-lbl">🧾 Orders</div><div className="k-val">{s.orders}</div></div>
        <div className="kpi"><div className="k-lbl">🍱 Items sold</div><div className="k-val">{s.totalSold}</div></div>
        <div className="kpi"><div className="k-lbl">👦 Boys</div><div className="k-val">{inr(b.revenue)}</div><div className="k-sub">{b.orders} orders</div></div>
        <div className="kpi"><div className="k-lbl">👧 Girls</div><div className="k-val">{inr(g.revenue)}</div><div className="k-sub">{g.orders} orders</div></div>
        <div className="kpi"><div className="k-lbl">🚫 Cancelled</div><div className="k-val">{s.cancelled}</div></div>
        <div className="kpi"><div className="k-lbl">⚠️ Low stock</div><div className="k-val">{s.lowStock.length}</div></div>
      </div>

      <div className="card pad split-card" style={{ marginTop: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>Revenue split</div>
        <div className="split-head">
          <span className="bh-boys">👦 Boys {bp}%</span>
          <span className="bh-girls">{100 - bp}% Girls 👧</span>
        </div>
        <div className="split-track">
          <span className="b-boys" style={{ width: `${bp}%` }} />
          <span className="b-girls" style={{ width: `${100 - bp}%` }} />
        </div>
        <div className="split-legend">
          <span><span className="dot" style={{ background: '#2458d0' }} />{inr(b.revenue)}</span>
          <span><span className="dot" style={{ background: '#d42e75' }} />{inr(g.revenue)}</span>
        </div>
      </div>

      {s.topItems.length > 0 && (
        <>
          <div className="divider-label">Top selling items</div>
          <div className="rank-list">
            {s.topItems.map((t, i) => (
              <div key={t.name} className="rank-row">
                <span className="rank-no">{['🥇', '🥈', '🥉'][i] || '#' + (i + 1)}</span>
                <div className="rank-main">
                  <div className="rank-line">
                    <span>{t.emoji || ''} {t.name}</span>
                    <span className="rn-amt">{inr(t.revenue)} · {t.sold}×</span>
                  </div>
                  <div className="rank-bar">
                    <span className="rank-fill" style={{ width: `${Math.max(6, Math.round((t.sold / maxSold) * 100))}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {s.lowStock.length > 0 && (
        <>
          <div className="divider-label">⚠️ Needs restocking</div>
          <div className="card pad">
            {s.lowStock.map((it) => (
              <div key={it.id} className="alert-row">
                <span className="alert-emoji">{it.emoji}</span>
                <span className="alert-name">{it.name}</span>
                <span className={`stock-pill ${it.stock === 0 ? 'sp-zero' : 'sp-low'}`}>
                  {it.stock === 0 ? 'OUT' : `${it.stock} left`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function PublicOrdersCard() {
  const [orders, setOrders] = useState<any[]>([])
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    try {
      const data = await api<any[]>('/api/public/admin-list')
      setOrders(Array.isArray(data) ? data : [])
    } catch (e: any) { setErr(e.message || 'Could not load') }
  }, [])
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t) }, [load])

  async function updateStatus(o: any, status: string) {
    try {
      await api('/api/public/admin-status', { method: 'POST', body: { id: o.id, status } })
      load()
    } catch (e: any) { toast(e.message, 'bad') }
  }

  return (
    <div className="card pad" style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 900 }}>🎟️ Public orders (code-only, admin view)</div>
        <button className="btn sm ghost" onClick={load}>↻ Refresh</button>
      </div>
      {err ? <div className="form-error show" style={{ marginTop: 8 }}>{err}</div> : null}
      {!orders.length ? (
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>No public orders yet. They appear here with their 6-digit code — staff and other users cannot see them.</p>
      ) : (
        <div style={{ marginTop: 10 }}>
          {orders.map((o) => (
            <div key={o.id} className="order-card enter" style={{ marginBottom: 10, padding: 12 }}>
              <div className="order-head">
                <div className="token-chip"><span className="tk-lbl">CODE</span><span className="tk-no">{o.code}</span></div>
                <div className="order-title">
                  <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                  <div className="order-time" style={{ marginTop: 3 }}>{timeAgo(o.createdAt)} · {clockTime(o.createdAt)} · {inr(o.total)}</div>
                </div>
              </div>
              <div className="order-items" style={{ marginTop: 10 }}>
                {o.items?.map((li: any, ix: number) => (
                  <div key={ix} className="oi-line">
                    <span className="oi-qty">{li.qty}×</span><span>{li.emoji || ''} {li.name}</span><span className="oi-dots" /><span className="oi-amt">{inr(li.lineTotal)}</span>
                  </div>
                ))}
              </div>
              {o.status === 'placed' && (
                <div className="order-actions" style={{ marginTop: 10 }}>
                  <button className="btn ok" onClick={() => updateStatus(o, 'completed')}>✓ Served</button>
                  <button className="btn sm soft-bad" style={{ flex: '0 0 auto' }} onClick={() => updateStatus(o, 'cancelled')}>Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
