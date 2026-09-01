'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api } from '@/lib/client'
import { toast } from '@/lib/ui'

type Mode = { kind: 'enter' } | { kind: 'reset' }

/**
 * Blocks the entire app until the common access password is entered.
 * Unlocked devices remember the current gate version — everyone is
 * locked out again automatically when the password changes.
 */
export function GateLock({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'locked' | 'open'>('checking')
  const [mode, setMode] = useState<Mode>({ kind: 'enter' })
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
      setState('open') // server unreachable: don't trap offline users
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

  return (
    <div className="login-wrap">
      <div className="login-logo">🔒</div>
      <h2 style={{ textAlign: 'center', fontSize: 21, fontWeight: 900 }}>Syllabites</h2>
      <p style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600, fontSize: 13, margin: '6px 0 22px' }}>
        {mode.kind === 'enter'
          ? 'Enter the access password to continue'
          : 'Answer your security question to set a new password'}
      </p>

      {mode.kind === 'enter' ? (
        <form onSubmit={submitEnter} noValidate>
          {err && <div className="form-error show">{err}</div>}
          <div className="field">
            <label>Access password</label>
            <input name="pw" type="password" autoComplete="current-password" placeholder="••••••••" autoFocus />
          </div>
          <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Unlock 🔓</button>
        </form>
      ) : (
        <form onSubmit={submitReset} noValidate>
          {err && <div className="form-error show">{err}</div>}
          <div className="field">
            <label>Enter your gmail</label>
            <input name="answer" type="text" autoCapitalize="none" placeholder="Your answer" autoFocus />
          </div>
          <div className="field">
            <label>New password</label>
            <input name="npw" type="password" autoComplete="new-password" placeholder="At least 4 characters" />
          </div>
          <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Set new password</button>
        </form>
      )}

      <div style={{ textAlign: 'center', marginTop: 18 }}>
        {mode.kind === 'enter' ? (
          <button className="admin-link" onClick={() => { setMode({ kind: 'reset' }); setErr('') }}>
            Forgot password?
          </button>
        ) : (
          <button className="admin-link" onClick={() => { setMode({ kind: 'enter' }); setErr('') }}>
            ← Back
          </button>
        )}
      </div>
      <div style={{ textAlign: 'center', marginTop: 22, fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.02em', opacity: 0.9 }}>
        Built by Guhanavish , Inspired from Harish C
      </div>
    </div>
  )
}

function buzzIn() { try { navigator.vibrate?.(20) } catch {} }
function toastUnlock() { toast('Password updated ✓', 'ok') }
