'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sb } from '@/lib/supabase'
import { api } from '@/lib/client'
import { inr, ordNo, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import type { Order } from '@/lib/fmt'
import { toast, buzz, chime, confirmBox } from '@/lib/ui'
import { startDeviceHeartbeat } from '@/lib/device'

type Board = {
  active: Order[]
  doneToday: { count: number; revenue: number }
  doneOrders: Order[]
}

export default function ReceiverPage() {
  const router = useRouter()
  const [section, setSection] = useState<'boys' | 'girls' | null>(null)
  const [tab, setTab] = useState<'new' | 'done'>('new')
  const [board, setBoard] = useState<Board>({ active: [], doneToday: { count: 0, revenue: 0 }, doneOrders: [] })
  const [soundOn, setSoundOn] = useState(true)
  const [error, setError] = useState('')
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const seenIds = useRef<Set<number>>(new Set())
  const firstLoad = useRef(true)

  /* ---------- session guard ---------- */
  useEffect(() => {
    let s: string | null = null
    try { s = localStorage.getItem('fc.section') } catch {}
    if (s !== 'boys' && s !== 'girls') router.replace('/')
    else setSection(s)
    try { setSoundOn(JSON.parse(localStorage.getItem('fc.sound') ?? 'true')) } catch {}
  }, [router])

  /* ---------- loader ---------- */
  const load = useCallback(async (isNewEvent = false) => {
    if (!section) return
    try {
      const b = await api<Board>('/api/board?section=' + section)
      const prevSeen = seenIds.current
      const fresh = b.active.filter((o) => o.status === 'placed' && !prevSeen.has(o.id))
      setBoard(b)
      b.active.forEach((o) => seenIds.current.add(o.id))
      if (!firstLoad.current && fresh.length && (isNewEvent || soundOn)) {
        chime(); buzz([60, 80, 60])
        toast(`🔥 New order ${ordNo(fresh[0])}!`, '', 3200)
      }
      firstLoad.current = false
      setError('')
    } catch (e: any) {
      setError(e.message || 'Connection issue')
    }
  }, [section, soundOn])

  useEffect(() => {
    if (!section) return
    load()
    const hb = startDeviceHeartbeat(section, 'receiver')
    const p = setInterval(() => load(), 10000) // fallback; realtime is primary
    return () => { hb(); clearInterval(p) }
  }, [section, load])

  /* ---------- realtime ---------- */
  useEffect(() => {
    if (!section) return
    const ch = sb()
      .channel('counter-' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load(true))
      .subscribe()
    return () => { sb().removeChannel(ch) }
  }, [section, load])

  async function serve(o: Order) {
    if (pendingIds.has(o.id)) return
    const code = ordNo(o)
    // optimistic: remove card instantly and block double-taps
    setBoard((prev) => ({ ...prev, active: prev.active.filter((x) => x.id !== o.id) }))
    setPendingIds((prev) => new Set(prev).add(o.id))
    try {
      const res: any = await api('/api/orders/status', { method: 'POST', body: { id: o.id, status: 'completed' } })
      buzz(15)
      if (res?.alreadyCompleted) {
        toast(`Order ${code} was already served by another staff`, '')
      } else {
        toast(`${code} served ✓`, 'ok')
      }
      load()
    } catch (e: any) {
      toast(e.message, 'bad')
      load()
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(o.id)
        return next
      })
    }
  }

  async function cancelOrder(o: Order) {
    const ok = await confirmBox({ title: `Cancel order ${ordNo(o)}?`, msg: 'Stock will be returned to the menu.', yes: 'Cancel order' })
    if (!ok) return
    try {
      await api('/api/orders/cancel', { method: 'POST', body: { id: o.id } })
      toast('Order cancelled · stock restored', 'ok')
      load()
    } catch (e: any) { toast(e.message, 'bad'); load() }
  }

  function toggleSound() {
    const v = !soundOn
    setSoundOn(v)
    localStorage.setItem('fc.sound', JSON.stringify(v))
    toast(v ? 'Sound alerts ON' : 'Sound alerts OFF')
    if (v) { import('@/lib/ui').then((m) => { m.ensureAudio(); m.chime() }) }
  }

  function switchUser() {
    confirmBox({ title: 'Switch user?', msg: '', yes: 'Switch', danger: false }).then((ok) => {
      if (!ok) return
      localStorage.removeItem('fc.role')
      router.push('/')
    })
  }

  const waiting = board.active.length
  const list = tab === 'new' ? board.active : board.doneOrders

  if (!section) return <div className="root" />

  return (
    <div className="root">
      <header className="topbar">
        <div className="sec-chip">{section === 'boys' ? '👦' : '👧'}</div>
        <div className="titles">
          <h1>{section === 'boys' ? 'Boys' : 'Girls'} Counter</h1>
          <div className="sub"><span className="live-dot" /> Live orders</div>
        </div>
        <button className="icon-btn" onClick={toggleSound} aria-label="Sound">{soundOn ? '🔔' : '🔕'}</button>
        <button className="icon-btn" onClick={switchUser} aria-label="Switch user">🚪</button>
      </header>

      <div className="scroll flush-bottom">
        <div className="stat-strip">
          <div className="mini-stat hot"><div className="ms-v">{waiting}</div><div className="ms-l">Waiting 🔥</div></div>
          <div className="mini-stat"><div className="ms-v">{board.doneToday.count}</div><div className="ms-l">Served ✓</div></div>
          <div className="mini-stat"><div className="ms-v">{inr(board.doneToday.revenue)}</div><div className="ms-l">Today ₹</div></div>
        </div>

        <div className="recv-tabs" style={{ marginTop: 0 }}>
          <button className={`rt${tab === 'new' ? ' on' : ''}`} onClick={() => setTab('new')}>
            Waiting <span className="cnt">{waiting}</span>
          </button>
          <button className={`rt${tab === 'done' ? ' on' : ''}`} onClick={() => setTab('done')}>
            Served today <span className="cnt">{board.doneToday.count}</span>
          </button>
        </div>

        <div style={{ height: 12 }} />
        <div className="board-list">
          {error && !list.length ? (
            <div className="empty"><span className="e-ico">📡</span><h3>Connection issue</h3><p>{error}</p></div>
          ) : list.length === 0 ? (
            tab === 'new' ? (
              <div className="empty"><span className="e-ico">📭</span><h3>All caught up</h3><p>New orders will pop in here<br />with a sound alert.</p></div>
            ) : (
              <div className="empty"><span className="e-ico">✅</span><h3>Nothing served yet</h3><p>Orders you mark as served<br />today show up here.</p></div>
            )
          ) : (
            list.map((o) => (
              <div key={o.id} className={`order-card${o.status === 'placed' ? ' enter' : ''}`}>
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
                </div>
                {o.status === 'placed' && (
                  <div className="order-actions">
                    <button className="btn ok" disabled={pendingIds.has(o.id)} onClick={() => serve(o)}>
                      {pendingIds.has(o.id) ? 'Serving…' : '✓ Served · handed over'}
                    </button>
                    <button className="btn sm soft-bad" style={{ flex: '0 0 auto', padding: '0 16px' }} onClick={() => cancelOrder(o)}>Cancel</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
