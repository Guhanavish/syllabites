'use client'

import { useEffect, useState } from 'react'
import { api, isSessionExpired } from '@/lib/client'
import { toast, buzz } from '@/lib/ui'
import { SalesTab } from './sales'
import { MenuTab } from './menu'
import { OrdersTab } from './orders'
import { SettingsTab } from './settings'


export default function AdminPage() {
  const [authed, setAuthed] = useState<null | boolean>(null)
  const [tab, setTab] = useState<'sales' | 'menu' | 'orders' | 'settings'>('sales')

  useEffect(() => {
    api('/api/admin/check').then(() => setAuthed(true)).catch(() => setAuthed(false))
  }, [])

  function handleExpired(e: any) {
    if (isSessionExpired(e)) {
      setAuthed(false)
      toast('Session expired — please log in again', 'bad')
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
  if (!authed) return <Login onSuccess={() => { buzz(15); setAuthed(true); setTab('sales') }} />

  return (
    <div className="root">
      <header className="topbar">
        <div className="sec-chip" style={{ background: 'var(--ink)', boxShadow: 'none' }}>🔐</div>
        <div className="titles">
          <h1>Admin Panel</h1>
          <div className="sub">Full control · menu, stock &amp; sales</div>
        </div>
        <button className="icon-btn" onClick={logout} aria-label="Logout">🚪</button>
      </header>

      <div className="scroll flush-bottom">
        <div style={{ display: tab === 'sales' ? '' : 'none' }}><SalesTab expired={handleExpired} /></div>
        <div style={{ display: tab === 'menu' ? '' : 'none' }}><MenuTab expired={handleExpired} /></div>
        <div style={{ display: tab === 'orders' ? '' : 'none' }}><OrdersTab expired={handleExpired} /></div>
        <div style={{ display: tab === 'settings' ? '' : 'none' }}>
          <SettingsTab expired={handleExpired} onLogout={logout} />
        </div>
      </div>

      <nav className="bottomnav">
        {([['sales', '📊', 'Sales'], ['menu', '📝', 'Menu'], ['orders', '🧾', 'Orders'], ['settings', '⚙️', 'Settings']] as const).map(([t, i, l]) => (
          <button key={t} className={`nav-tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>
            <span className="ico">{i}</span>{l}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Login({ onSuccess }: { onSuccess: () => void }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true)
    setErr('')
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: { username: String(fd.get('u') || '').trim(), password: String(fd.get('p') || '') },
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
        {err && <div className="form-error show">{err}</div>}
        <div className="field">
          <label>User ID</label>
          <input name="u" type="text" autoComplete="username" autoCapitalize="none" placeholder="e.g. admin" />
        </div>
        <div className="field">
          <label>Password</label>
          <input name="p" type="password" autoComplete="current-password" placeholder="••••••••" />
        </div>
        <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Sign in</button>
      </form>
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <a className="admin-link" href="/" style={{ textDecoration: 'none' }}>← Back to Food Court</a>
      </div>
    </div>
  )
}
