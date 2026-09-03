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
          <div style={{ textAlign: 'center', marginTop: 22 }}>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: '0.02em', color: 'var(--ink)' }}>Built By Guhanavish</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10 }}>
              <a href="https://github.com/Guhanavish" target="_blank" rel="noopener noreferrer" aria-label="Github" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-1)', transition: 'transform .15s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.207 11.387.6.11.793-.26.793-.577v-2.165c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.468-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22v3.293c0 .32.192.694.8.576C20.566 21.797 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>
              </a>
              <a href="https://www.linkedin.com/in/guhanavish-ss-12a328256" target="_blank" rel="noopener noreferrer" aria-label="Linkedin" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-1)', transition: 'transform .15s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.777 13.019H3.56V9h3.554v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href="https://www.instagram.com/guha._.1416/?__pwa=1" target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', boxShadow: 'var(--shadow-1)', transition: 'transform .15s' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none"/></svg>
              </a>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish - XI , Inspired From Harish C - XII</div>
          </div>
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
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish - XI , Inspired From Harish C - XII</div>
        </div>
      ) : gateTab === 'order' ? (
        <div className="scroll" style={{ paddingTop: 14 }}>
          <div style={{ textAlign: 'left', marginBottom: 8 }}>
            <button className="admin-link" onClick={() => setGateTab('welcome')}>← Back to Welcome</button>
          </div>
          <PublicOrder />
          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish - XI , Inspired From Harish C - XII</div>
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
          <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>Built by Guhanavish - XI , Inspired From Harish C - XII</div>
        </div>
      )}
    </div>
  )
}

function buzzIn() { try { navigator.vibrate?.(20) } catch {} }
function toastUnlock() { toast('Password updated ✓', 'ok') }
