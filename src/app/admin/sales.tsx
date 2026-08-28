'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client'
import { inr } from '@/lib/fmt'
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

  return (
    <>
      <div className="range-seg">
        {[['today', 'Today'], ['week', '7 days'], ['all', 'All time']].map(([v, l]) => (
          <button key={v} className={range === v ? 'on' : ''} onClick={() => setRange(v)}>{l}</button>
        ))}
      </div>

      {/* Active devices — separate for Boys / Girls */}
      <div className="card pad" style={{ marginBottom: 14, border: '1px solid var(--line)' }}>
        <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 10 }}>📱 Active devices (last 2 min)</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.04em' }}>👦 BOYS</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{dev.boys.total}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>
              {dev.boys.sender} sender · {dev.boys.receiver} receiver
            </div>
          </div>
          <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', letterSpacing: '.04em' }}>👧 GIRLS</div>
            <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{dev.girls.total}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 2 }}>
              {dev.girls.sender} sender · {dev.girls.receiver} receiver
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginTop: 8 }}>
          Total online now: {dev.total} device{dev.total === 1 ? '' : 's'}
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
