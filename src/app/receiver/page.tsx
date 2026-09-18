'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'
import { api } from '@/lib/client'
import { inr, ordNo, timeAgo, clockTime, statusPill, statusCls } from '@/lib/fmt'
import type { Order } from '@/lib/fmt'
import { toast, buzz, chime, confirmBox, every, lockGate } from '@/lib/ui'
import { startDeviceHeartbeat } from '@/lib/device'
import { IconReceipt, IconBox, IconCheck, IconSearch, IconBell, IconBellOff, IconDoor, IconLock } from '@/components/icons'

type Board = {
  active: Order[]
  activeCount?: number
  doneToday: { count: number; revenue: number }
  doneOrders: Order[]
}

/* Entrance (parcel) orders, price-blind for staff: code + customer + items only */
type ParcelLine = { name: string; emoji: string | null; qty: number }
type ParcelOrder = {
  id: number
  code: string
  status: string
  createdAt: string
  customerName: string
  customerClass: string
  customerSection: string
  eventName: string
  items: ParcelLine[]
}
type ParcelBoard = {
  active: ParcelOrder[]
  activeCount?: number
  doneToday: { count: number }
  doneOrders: ParcelOrder[]
}

export default function ReceiverPage() {
  const router = useRouter()
  const [section, setSection] = useState<'boys' | 'girls' | null>(null)
  const [tab, setTab] = useState<'new' | 'parcel' | 'done'>('new')
  const [board, setBoard] = useState<Board>({ active: [], doneToday: { count: 0, revenue: 0 }, doneOrders: [] })
  const [parcel, setParcel] = useState<ParcelBoard>({ active: [], doneToday: { count: 0 }, doneOrders: [] })
  const [soundOn, setSoundOn] = useState(true)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [parcelLoaded, setParcelLoaded] = useState(false)
  const [parcelError, setParcelError] = useState('')
  const [doneVisible, setDoneVisible] = useState(10)
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())
  const [pendingParcel, setPendingParcel] = useState<Set<number>>(new Set())
  const seenIds = useRef<Set<number>>(new Set())
  const seenParcel = useRef<Set<number>>(new Set())
  const firstLoad = useRef(true)
  const firstParcelLoad = useRef(true)

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
        toast(`New order ${ordNo(fresh[0])}`, '', 3200)
      }
      firstLoad.current = false
      setLoaded(true)
      setError('')
    } catch (e: any) {
      setError(e.message || 'Connection issue')
      setLoaded(true)
    }
  }, [section, soundOn])

  useEffect(() => {
    if (!section) return
    load()
    const hb = startDeviceHeartbeat(section, 'receiver')
    const p = every(10000, () => load()) // fallback; realtime is primary
    return () => { hb(); p() }
  }, [section, load])

  /* ---------- parcel loader (entrance orders, price-blind) ---------- */
  const loadParcel = useCallback(async (isNewEvent = false) => {
    try {
      const b = await api<ParcelBoard>('/api/parcel/board')
      const fresh = b.active.filter((o) => o.status === 'placed' && !seenParcel.current.has(o.id))
      setParcel(b)
      b.active.forEach((o) => seenParcel.current.add(o.id))
      if (!firstParcelLoad.current && fresh.length && (isNewEvent || soundOn)) {
        chime(); buzz([60, 80, 60])
        toast(`New parcel order ${fresh[0].code}`, '', 3200)
      }
      firstParcelLoad.current = false
      setParcelLoaded(true)
      setParcelError('')
    } catch {
      setParcelLoaded(true)
      setParcelError("Can't reach the server. Check your internet connection.")
    }
  }, [soundOn])

  useEffect(() => {
    loadParcel()
    const t = every(10000, () => loadParcel())
    return () => t()
  }, [loadParcel])

  /* ---------- realtime ---------- */
  useEffect(() => {
    if (!section) return
    const ch = db()
      .channel('counter-' + Math.random())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'public_orders' }, () => loadParcel(true))
      .subscribe()
    return () => { db().removeChannel(ch) }
  }, [section, load, loadParcel])

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
        toast(`${code} served`, 'ok')
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

  /* ---------- parcel actions (shared queue, both counters see it) ---------- */
  async function serveParcel(o: ParcelOrder) {
    if (pendingParcel.has(o.id)) return
    // optimistic: remove card instantly and block double-taps
    setParcel((prev) => ({ ...prev, active: prev.active.filter((x) => x.id !== o.id) }))
    setPendingParcel((prev) => new Set(prev).add(o.id))
    try {
      const res: any = await api('/api/parcel/serve', { method: 'POST', body: { id: o.id, status: 'completed' } })
      buzz(15)
      if (res?.alreadyCompleted) {
        toast(`Parcel ${o.code} was already served by another counter`, '')
      } else {
        toast(`Parcel ${o.code} served`, 'ok')
      }
      loadParcel()
    } catch (e: any) {
      toast(e.message, 'bad')
      loadParcel()
    } finally {
      setPendingParcel((prev) => {
        const next = new Set(prev)
        next.delete(o.id)
        return next
      })
    }
  }

  async function cancelParcel(o: ParcelOrder) {
    const ok = await confirmBox({ title: `Cancel parcel ${o.code}?`, msg: 'Stock will be returned to the parcel menu.', yes: 'Cancel order' })
    if (!ok) return
    try {
      await api('/api/parcel/serve', { method: 'POST', body: { id: o.id, status: 'cancelled' } })
      toast('Parcel cancelled · stock restored', 'ok')
      loadParcel()
    } catch (e: any) { toast(e.message, 'bad'); loadParcel() }
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

  /* The Welcome hub only renders while the gate is locked, so going
     there re-locks this device. Section, role and sound stay. */
  function goWelcome() {
    buzz(10)
    lockGate()
    router.push('/')
  }

  const [search, setSearch] = useState('')
  const waiting = board.activeCount ?? board.active.length
  const parcelWaiting = parcel.activeCount ?? parcel.active.length
  const rawList = tab === 'new' ? board.active : board.doneOrders
  // Seamless order-number search (filters locally, no extra fetch, debounced via deferred value)
  const list = rawList.filter((o) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return String(o.id).includes(q) || String((o as any).tokenNo ?? (o as any).token_no ?? '').toLowerCase().includes(q) || ordNo(o).toLowerCase().includes(q)
  })
  const parcelRaw = tab === 'parcel' ? parcel.active : []
  const parcelList = parcelRaw.filter((o) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return `${o.code} ${o.customerName} ${o.customerClass} ${o.customerSection} ${o.eventName}`.toLowerCase().includes(q)
  })

  if (!section) return <div className="root" />

  return (
    <div className="root">
      <header className="topbar">
        <div className="sec-chip" aria-hidden="true">{section === 'boys' ? 'B' : 'G'}</div>
        <div className="titles">
          <h1>{section === 'boys' ? 'Boys' : 'Girls'} Counter</h1>
          <div className="sub"><span className="live-dot" /> Live orders</div>
        </div>
        <button className="icon-btn" onClick={toggleSound} aria-label="Sound">{soundOn ? <IconBell size={19} /> : <IconBellOff size={19} />}</button>
        <button className="icon-btn" onClick={goWelcome} aria-label="Go to Welcome page"><IconLock size={18} /></button>
        <button className="icon-btn" onClick={switchUser} aria-label="Switch user"><IconDoor size={19} /></button>
      </header>

      <div className="scroll flush-bottom">
        <div className="stat-strip">
          <div className="mini-stat hot"><div className="ms-v">{waiting}</div><div className="ms-l">Waiting</div></div>
          <div className="mini-stat"><div className="ms-v">{board.doneToday.count}</div><div className="ms-l">Served</div></div>
          <div className="mini-stat"><div className="ms-v">{inr(board.doneToday.revenue)}</div><div className="ms-l">Today ₹</div></div>
        </div>

        <div className="recv-tabs" style={{ marginTop: 0 }}>
          <button className={`rt${tab === 'new' ? ' on' : ''}`} onClick={() => setTab('new')}>
            Waiting <span className="cnt">{waiting}</span>
          </button>
          <button className={`rt${tab === 'parcel' ? ' on' : ''}`} onClick={() => setTab('parcel')}>
            <IconBox size={17} /> Parcel <span className="cnt">{parcelWaiting}</span>
          </button>
          <button className={`rt${tab === 'done' ? ' on' : ''}`} onClick={() => setTab('done')}>
            Served today <span className="cnt">{board.doneToday.count}</span>
          </button>
        </div>

        <div className="search-wrap" style={{ marginTop: 4 }}>
          <span className="s-ico"><IconSearch size={17} /></span>
          <input type="text" placeholder={tab === 'parcel' ? 'Search code, name, event…' : 'Search order number (e.g. B-12)…'} value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
        </div>
        <div style={{ height: 12 }} />
        <div className="board-list">
          {!loaded ? (
            <>
              <div className="skel skel-row" /><div className="skel skel-row" /><div className="skel skel-row" />
            </>
          ) : tab === 'parcel' ? (
            !parcelLoaded ? (
              <>
                <div className="skel skel-row" /><div className="skel skel-row" />
              </>
            ) : parcelError && parcelList.length === 0 ? (
              <div className="empty"><span className="e-ico" aria-hidden="true"><IconBell size={24} /></span><h3>Connection issue</h3><p>{parcelError}</p><button className="btn btn-primary" onClick={() => loadParcel()}>Try again</button></div>
            ) : parcelList.length === 0 ? (
              <div className="empty"><span className="e-ico" aria-hidden="true"><IconBox size={24} /></span><h3>No parcel orders</h3><p>Entrance orders will pop in here<br />with a sound alert.</p></div>
            ) : (
              <>
              {(parcel.activeCount ?? 0) > parcel.active.length && !search.trim() && (
                <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                  Showing oldest {parcel.active.length} of {parcel.activeCount} — serve to reveal more
                </div>
              )}
              {parcelList.map((o) => (
                <div key={o.id} className={`order-card${o.status === 'placed' ? ' enter' : ''}`}>
                  <div className="order-head">
                    <div className="token-chip">
                      <span className="tk-lbl">CODE</span><span className="tk-no">{o.code}</span>
                    </div>
                    <div className="order-title">
                      <span className={`badge-pill ${statusCls(o.status)}`}>{statusPill(o.status)}</span>
                      <div className="order-time" style={{ marginTop: 3 }}>
                        {timeAgo(o.createdAt)} · {clockTime(o.createdAt)}
                      </div>
                    </div>
                    <span className="badge-pill" style={{ background: 'var(--bg-soft)', color: 'var(--ink)' }}>Parcel</span>
                  </div>
                  <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: '8px 12px', marginTop: 10, fontSize: 12, fontWeight: 600 }}>
                    {o.customerName} · {o.customerClass} · {o.customerSection} · {o.eventName}
                  </div>
                  <div className="order-items">
                    {o.items.map((li, ix) => (
                      <div key={ix} className="oi-line">
                        <span className="oi-qty">{li.qty}×</span>
                        <span>{li.emoji || ''} {li.name}</span>
                      </div>
                    ))}
                  </div>
                  {o.status === 'placed' && (
                    <div className="order-actions">
                      <button className="btn ok" disabled={pendingParcel.has(o.id)} onClick={() => serveParcel(o)}>
                        {pendingParcel.has(o.id) ? 'Serving…' : 'Mark served'}
                      </button>
                      <button className="btn sm soft-bad" style={{ flex: '0 0 auto', padding: '0 16px' }} onClick={() => cancelParcel(o)}>Cancel</button>
                    </div>
                  )}
                </div>
              ))}
              </>
            )
          ) : error && !list.length ? (
            <div className="empty"><span className="e-ico" aria-hidden="true"><IconBell size={24} /></span><h3>Connection issue</h3><p>{error}</p><button className="btn btn-primary" onClick={() => load()}>Try again</button></div>
          ) : list.length === 0 ? (
            tab === 'new' ? (
              <div className="empty"><span className="e-ico" aria-hidden="true"><IconReceipt size={24} /></span><h3>All caught up</h3><p>New orders will pop in here<br />with a sound alert.</p></div>
            ) : (
              <div className="empty"><span className="e-ico" aria-hidden="true"><IconCheck size={24} /></span><h3>Nothing served yet</h3><p>Orders you mark as served<br />today show up here.</p></div>
            )
          ) : (
            <>
              {tab === 'new' && (board.activeCount ?? 0) > board.active.length && !search.trim() && (
                <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 4 }}>
                  Showing oldest {board.active.length} of {board.activeCount} — serve to reveal more
                </div>
              )}
              {(tab === 'done' ? list.slice(0, doneVisible) : list).map((o) => (
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
                      {pendingIds.has(o.id) ? 'Serving…' : 'Mark served'}
                    </button>
                    <button className="btn sm soft-bad" style={{ flex: '0 0 auto', padding: '0 16px' }} onClick={() => cancelOrder(o)}>Cancel</button>
                  </div>
                )}
              </div>
            ))}
            {tab === 'done' && list.length > doneVisible && (
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>
                  Showing {doneVisible} of {list.length}
                </div>
                <button className="btn btn-ghost" onClick={() => setDoneVisible((v) => v + 15)}>Show more</button>
              </div>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
