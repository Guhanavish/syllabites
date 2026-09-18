'use client'

import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/client'
import { inr, ordNo, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import type { Order } from '@/lib/fmt'
import { toast, confirmBox, every } from '@/lib/ui'
import { IconReceipt } from '@/components/icons'

export function OrdersTab({ expired }: { expired: (e: any) => boolean }) {
  const [section, setSection] = useState('all')
  const [status, setStatus] = useState('all')
  const [today, setToday] = useState(true)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(15)

  const load = useCallback(async (sec: string, st: string, td: boolean) => {
    try {
      const res = await api<Order[]>(
        `/api/orders?section=${sec}&status=${st}&today=${td}`
      )
      setOrders(Array.isArray(res) ? res : [])
    } catch (e: any) { expired(e) } finally { setLoading(false) }
  }, [expired])

  useEffect(() => { setLoading(true); setVisible(15); load(section, status, today) }, [section, status, today, load])
  useEffect(() => {
    const stop = every(15000, () => load(section, status, today))
    return () => stop()
  }, [section, status, today, load])

  async function cancelOrder(o: Order) {
    const ok = await confirmBox({ title: `Cancel order ${ordNo(o)}?`, msg: 'Stock will be restored automatically.', yes: 'Cancel order' })
    if (!ok) return
    try {
      await api('/api/orders/cancel', { method: 'POST', body: { id: o.id } })
      toast('Order cancelled', 'ok')
      load(section, status, today)
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
  }

  return (
    <>
      <div className="chips-row" style={{ marginBottom: 12 }}>
        {[['all', 'All'], ['boys', '👦 Boys'], ['girls', '👧 Girls']].map(([v, l]) => (
          <button key={v} className={`chip${section === v ? ' on' : ''}`} onClick={() => setSection(v)}>{l}</button>
        ))}
        {[['today', 'Today'], ['alltime', 'All time']].map(([v, l]) => (
          <button key={v} className={`chip${(v === 'today') === today ? ' on' : ''}`}
            onClick={() => setToday(v === 'today')}>{l}</button>
        ))}
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Any status</option>
          <option value="placed">Sent</option>
          <option value="completed">Served</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <>
          <div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" />
        </>
      ) : !orders.length ? (
        <div className="empty">
          <span className="e-ico" aria-hidden="true"><IconReceipt size={24} /></span><h3>No orders found</h3><p>Try changing the filters above.</p>
        </div>
      ) : (
        <>
          {orders.slice(0, visible).map((o) => (
          <div key={o.id} className="order-card" style={{ marginBottom: 12 }}>
            <div className="order-head">
              <div className="token-chip" style={o.status === 'cancelled' ? { background: 'var(--bad)' } : undefined}>
                <span className="tk-lbl">ORDER</span><span className="tk-no">{ordNo(o)}</span>
              </div>
              <div className="order-title">
                <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                <div className="order-time" style={{ marginTop: 3 }}>
                  {timeAgo(o.createdAt)} · {clockTime(o.createdAt)}
                </div>
              </div>
              <span className={`badge-pill ${o.section === 'boys' ? 'st-boys' : 'st-girls'}`}>
                {o.section === 'boys' ? '👦' : '👧'}
              </span>
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
            <div className="order-foot">
              <div className="order-total">Total<b>{inr(o.total)}</b></div>
              {o.status === 'placed' && (
                <button className="btn sm soft-bad" onClick={() => cancelOrder(o)}>Cancel</button>
              )}
            </div>
          </div>
        ))}
        {orders.length > visible && (
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
              Showing {visible} of {orders.length}
            </div>
            <button className="btn btn-ghost" onClick={() => setVisible((v) => v + 15)}>Show more</button>
          </div>
        )}
        </>
      )}
    </>
  )
}
