'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/client'
import { toast } from '@/lib/ui'
import { PublicOrder } from '@/components/PublicOrder'

type Mode = { kind: 'enter' } | { kind: 'reset' }

/**
 * Blocks the entire app until the common access password is entered.
 * Unlocked devices remember the current gate version — everyone is
 * locked out again automatically when the password changes.
 */
export function GateLock({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>(() => {
    // instant optimistic open from cache — avoids page-switch lag
    try {
      if (typeof window !== 'undefined' && localStorage.getItem('fc.gate')) return 'open'
    } catch {}
    return 'checking'
  })
  const [mode, setMode] = useState<Mode>({ kind: 'enter' })
  const [gateTab, setGateTab] = useState<'welcome' | 'order' | 'staff'>('welcome')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const check = useCallback(async () => {
    try {
      const st = await api<{ version: number }>('/api/gate/status')
      let saved: { v?: number } = {}
      try { saved = JSON.parse(localStorage.getItem('fc.gate') || '{}') } catch {}
      if (saved.v === st.version) setState('open')
      else setState('locked')
    } catch {
      // keep optimistic open on error to avoid blocking navigation
      try {
        if (localStorage.getItem('fc.gate')) setState('open')
        else setState('locked')
      } catch { setState('locked') }
    }
  }, [])

  useEffect(() => { check() }, [check])

  function unlock(version: number) {
    localStorage.setItem('fc.gate', JSON.stringify({ v: version }))
    buzzIn()
    setState('open')
  }

  async function submitEnter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pw = String(new FormData(e.currentTarget).get('pw') || '')
    if (!pw) return
    setBusy(true); setErr('')
    try {
      const r = await api<{ version: number }>('/api/gate/verify', { method: 'POST', body: { password: pw } })
      unlock(r.version)
    } catch (ex: any) {
      setErr(ex.message || 'Wrong password')
    } finally { setBusy(false) }
  }

  async function submitReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setBusy(true); setErr('')
    try {
      const r = await api<{ version: number }>('/api/gate/reset', {
        method: 'POST',
        body: { answer: String(fd.get('answer') || ''), newPassword: String(fd.get('npw') || '') },
      })
      toastUnlock()
      unlock(r.version)
    } catch (ex: any) {
      setErr(ex.message || 'Reset failed')
    } finally { setBusy(false) }
  }

  if (state === 'open') return <>{children}</>
  if (state === 'checking') return <div className="root" />

  const isReset = mode.kind === 'reset'
  if (gateTab === 'welcome' && !isReset) {
    return (
      <div className="root" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="scroll" style={{ paddingTop: 0 }}>
          <div className="hero" style={{ margin: -16, marginBottom: 18, borderRadius: '0 0 28px 28px' }}>
            <span className="float" style={{ top: 18, right: 22 }}>🥟</span>
            <span className="float" style={{ bottom: 16, right: 64, animationDelay: '1.4s' }}>🥤</span>
            <span className="float" style={{ top: 44, right: 120, animationDelay: '.7s' }}>🍚</span>
            <span className="logo" style={{ fontSize: 48 }}>🍽️</span>
            <h1 style={{ marginTop: 8 }}>Welcome</h1>
            <p>The campus food court, reimagined — fresh orders, zero queue.</p>
          </div>
          <div style={{ padding: '6px 2px 0' }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, textAlign: 'center' }}>Welcome to Syllabites</h2>
            <p style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, fontSize: 13, marginTop: 6 }}>
              Choose how you&apos;d like to continue.
            </p>
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <button className="btn btn-primary xl block" onClick={() => setGateTab('order')}>🍽️ Place Order</button>
              <button className="btn btn-dark xl block" onClick={() => setGateTab('staff')}>🔒 Staff Environment</button>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish , Inspired from Harish C</div>
        </div>
      </div>
    )
  }

  return (
    <div className="root" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="topbar" style={{ justifyContent: 'center', gap: 8 }}>
        <button className={`chip ${gateTab === 'order' && !isReset ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', padding: '9px 10px' }} onClick={() => { setGateTab('order'); setMode({ kind: 'enter' }); setErr('') }}>🍽️ Order Food</button>
        <button className={`chip ${gateTab === 'staff' && !isReset ? 'on' : ''}`} style={{ flex: 1, justifyContent: 'center', display: 'inline-flex', padding: '9px 10px' }} onClick={() => { setGateTab('staff'); setMode({ kind: 'enter' }); setErr('') }}>🔒 Staff Access</button>
      </div>

      {isReset ? (
        <div className="login-wrap" style={{ flex: 1 }}>
          <div className="login-logo">🔒</div>
          <h2 style={{ textAlign: 'center', fontSize: 21, fontWeight: 900 }}>Syllabites</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, fontSize: 13, margin: '6px 0 22px' }}>Answer your security question to set a new password</p>
          <form onSubmit={submitReset} noValidate>
            {err && <div className="form-error show">{err}</div>}
            <div className="field"><label>Enter your gmail</label><input name="answer" type="text" autoCapitalize="none" placeholder="Your answer" autoFocus /></div>
            <div className="field"><label>New password</label><input name="npw" type="password" autoComplete="new-password" placeholder="At least 4 characters" /></div>
            <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Set new password</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button className="admin-link" onClick={() => { setMode({ kind: 'enter' }); setErr('') }}>← Back</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish , Inspired from Harish C</div>
        </div>
      ) : gateTab === 'order' ? (
        <div className="scroll" style={{ paddingTop: 14 }}>
          <div style={{ textAlign: 'left', marginBottom: 8 }}>
            <button className="admin-link" onClick={() => setGateTab('welcome')}>← Back to Welcome</button>
          </div>
          <PublicOrder />
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish , Inspired from Harish C</div>
        </div>
      ) : (
        <div className="login-wrap" style={{ flex: 1 }}>
          <div className="login-logo">🔒</div>
          <h2 style={{ textAlign: 'center', fontSize: 21, fontWeight: 900 }}>Syllabites</h2>
          <p style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, fontSize: 13, margin: '6px 0 22px' }}>Enter the access password to continue</p>
          <form onSubmit={submitEnter} noValidate>
            {err && <div className="form-error show">{err}</div>}
            <div className="field"><label>Access password</label><input name="pw" type="password" autoComplete="current-password" placeholder="••••••••" autoFocus /></div>
            <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Unlock 🔓</button>
          </form>
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button className="admin-link" onClick={() => { setMode({ kind: 'reset' }); setErr('') }}>Forgot password?</button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish , Inspired from Harish C</div>
        </div>
      )}
    </div>
  )
}

function buzzIn() { try { navigator.vibrate?.(20) } catch {} }
function toastUnlock() { toast('Password updated ✓', 'ok') }
