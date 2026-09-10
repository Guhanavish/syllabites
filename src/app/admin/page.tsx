'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { api, isSessionExpired } from '@/lib/client'
import { toast, buzz, useOnline } from '@/lib/ui'
import { IconChart, IconEdit, IconReceipt, IconGear, IconDoor, IconLock } from '@/components/icons'

/* Code-split below-the-fold tabs so the first admin paint ships less JS. */
const SalesTab = dynamic(() => import('./sales').then((m) => m.SalesTab), {
  loading: () => <div><div className="skel skel-row" /><div className="skel skel-row" /></div>,
})
const MenuTab = dynamic(() => import('./menu').then((m) => m.MenuTab), {
  loading: () => <div><div className="skel skel-row" /><div className="skel skel-row" /></div>,
})
const OrdersTab = dynamic(() => import('./orders').then((m) => m.OrdersTab), {
  loading: () => <div><div className="skel skel-row" /><div className="skel skel-row" /></div>,
})
const SettingsTab = dynamic(() => import('./settings').then((m) => m.SettingsTab), {
  loading: () => <div><div className="skel skel-row" /><div className="skel skel-row" /></div>,
})


export default function AdminPage() {
  const [authed, setAuthed] = useState<null | boolean>(null)
  const [tab, setTab] = useState<'sales' | 'menu' | 'orders' | 'settings'>(() => {
    try {
      const t = localStorage.getItem('fc.admin.tab')
      if (t === 'sales' || t === 'menu' || t === 'orders' || t === 'settings') return t
    } catch {}
    return 'sales'
  })
  const [notice, setNotice] = useState('')

  function pickTab(t: 'sales' | 'menu' | 'orders' | 'settings') {
    setTab(t)
    try { localStorage.setItem('fc.admin.tab', t) } catch {}
  }

  useEffect(() => {
    api('/api/admin/check').then(() => setAuthed(true)).catch(() => setAuthed(false))
  }, [])

  function handleExpired(e: any) {
    if (isSessionExpired(e)) {
      setAuthed(false)
      setNotice('Your session expired, please sign in again. You will land back on your last tab.')
      return true
    }
    return false
  }

  async function logout() {
    try { await api('/api/admin/logout', { method: 'POST' }) } catch {}
    setAuthed(false)
    toast('Logged out', 'ok')
  }

  if (authed === null) return <div className="root" />
  if (!authed) return <Login notice={notice} onSuccess={() => { buzz(15); setNotice(''); setAuthed(true) }} />

  return (
    <div className="root">
      <header className="topbar">
        <div className="sec-chip" style={{ background: 'var(--ink)', boxShadow: 'none' }}><IconLock size={18} /></div>
        <div className="titles">
          <h1>Admin Panel</h1>
          <div className="sub">Full control · menu, stock &amp; sales</div>
        </div>
        <button className="icon-btn" onClick={logout} aria-label="Logout"><IconDoor size={19} /></button>
      </header>

      <div className="scroll flush-bottom" style={{ contain: 'content' }}>
        {tab === 'sales' && <SalesTab expired={handleExpired} />}
        {tab === 'menu' && <MenuTab expired={handleExpired} />}
        {tab === 'orders' && <OrdersTab expired={handleExpired} />}
        {tab === 'settings' && <SettingsTab expired={handleExpired} onLogout={logout} />}
      </div>

      <nav className="bottomnav">
        {([
          ['sales', <IconChart key="i" size={22} />, 'Sales'],
          ['menu', <IconEdit key="i" size={22} />, 'Menu'],
          ['orders', <IconReceipt key="i" size={22} />, 'Orders'],
          ['settings', <IconGear key="i" size={22} />, 'Settings'],
        ] as const).map(([t, i, l]) => (
          <button
            key={t}
            className={`nav-tab${tab === t ? ' on' : ''}`}
            onClick={() => {
              // instant tab switch with transition, no layout thrash
              if (t !== tab) pickTab(t as any)
            }}
          >
            <span className="ico">{i}</span>{l}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Login({ notice, onSuccess }: { notice?: string; onSuccess: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const online = useOnline()

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const user = String(fd.get('u') || '').trim()
    const pass = String(fd.get('p') || '')
    if (!user) { setErr('Enter your admin user ID'); return }
    if (!pass) { setErr('Enter your admin password'); return }
    setBusy(true)
    setErr('')
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: { username: user, password: pass },
      })
      onSuccess()
    } catch (ex: any) {
      setErr(ex.message || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">🔐</div>
      <h2 style={{ textAlign: 'center', fontSize: 21, fontWeight: 900 }}>Admin Login</h2>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, fontSize: 13, margin: '6px 0 22px' }}>
        Menu, stock &amp; sales are managed here
      </p>
      <form onSubmit={submit} noValidate>
        {notice && <div className="form-error show" style={{ background: 'var(--warn-tint)', color: 'var(--warn)' }}>{notice}</div>}
        {err && <div className="form-error show">{err}</div>}
        {!online && <div className="form-error show">Can&apos;t reach the server. Check your internet connection.</div>}
        <div className="field">
          <label>User ID</label>
          <input name="u" type="text" autoComplete="username" autoCapitalize="none" placeholder="e.g. admin" />
          <div className="hint">The login name set in admin settings.</div>
        </div>
        <div className="field">
          <label>Password</label>
          <input name="p" type="password" autoComplete="current-password" placeholder="••••••••" />
          <div className="hint">At least 6 characters.</div>
        </div>
        <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy || !online}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <a className="admin-link" href="/" style={{ textDecoration: 'none' }}>← Back to Food Court</a>
      </div>
    </div>
  )
}
