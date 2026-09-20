'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { api } from '@/lib/client'
import { toast } from '@/lib/ui'
import { warmCritical } from '@/lib/db'
import { BrandHero, Credits } from '@/components/brand'
import dynamic from 'next/dynamic'
import { IconBack, IconLock } from '@/components/icons'

/* Split the parcel menu bundle off the first paint: it only mounts when
   the visitor opens the Order tab, and shows skeletons while loading. */
const PublicOrder = dynamic(() => import('@/components/PublicOrder').then((m) => m.PublicOrder), {
  loading: () => (
    <div>
      <div className="skel skel-row" />
      <div className="skel skel-row" />
      <div className="skel skel-row" />
    </div>
  ),
})

type Mode = { kind: 'enter' } | { kind: 'reset' }

export function GateLock({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const legal =
    pathname === '/terms' || pathname === '/privacy'
  // Always render locked on the first pass so SSR and hydration agree.
  // The effect below re-opens instantly from cache on mount.
  const [state, setState] = useState<'locked' | 'open'>('locked')
  const [mode, setMode] = useState<Mode>({ kind: 'enter' })
  const [gateTab, setGateTab] = useState<'welcome' | 'order' | 'staff'>('welcome')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const check = useCallback(async () => {
    try {
      // optimistic instant open from cache (avoids page-switch lag);
      // the version check below re-locks if the password changed.
      if (localStorage.getItem('fc.gate')) setState('open')
    } catch {}
    try {
      const st = await api<{ version: number }>('/api/gate/status')
      let saved: { v?: number } = {}
      try { saved = JSON.parse(localStorage.getItem('fc.gate') || '{}') } catch {}
      if (saved.v === st.version) setState('open')
      else setState('locked')
    } catch {
      try {
        if (localStorage.getItem('fc.gate')) setState('open')
        else setState('locked')
      } catch { setState('locked') }
    }
  }, [])

  useEffect(() => { check(); warmCritical() }, [check])

  /* Staff screens re-lock the device via lockGate() to jump to Welcome. */
  useEffect(() => {
    const lock = () => { setMode({ kind: 'enter' }); setErr(''); setGateTab('welcome'); setState('locked') }
    window.addEventListener('fc:lock', lock)
    return () => window.removeEventListener('fc:lock', lock)
  }, [])

  function unlock(version: number) {
    localStorage.setItem('fc.gate', JSON.stringify({ v: version }))
    buzzIn()
    setState('open')
  }

  async function submitEnter(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pw = String(new FormData(e.currentTarget).get('pw') || '')
    if (!pw) { setErr('Enter the access password to continue'); return }
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

  if (legal) return <>{children}</>

  if (state === 'open') return <>{children}</>

  const isReset = mode.kind === 'reset'
  if (gateTab === 'welcome' && !isReset) {
    return (
      <div className="gate-root">
        <div className="scroll gate-scroll">
          <BrandHero title="Welcome" sub="Order from your counter and pick up by number. No standing in line." />
          <div className="welcome-layout">
            <h2 className="welcome-title">Welcome to Syllabites</h2>
            <p className="welcome-sub">Choose how you&apos;d like to continue.</p>
            <div className="welcome-actions">
              <button className="btn btn-primary xl block" onClick={() => setGateTab('order')}>Place Order</button>
              <button className="btn btn-dark xl block" onClick={() => setGateTab('staff')}>Staff Access</button>
            </div>
          </div>
          <Credits />
        </div>
      </div>
    )
  }

  return (
    <div className="gate-root">
      <div className="topbar gate-topbar">
        <button className={`chip${gateTab === 'order' && !isReset ? ' on' : ''}`} onClick={() => { setGateTab('order'); setMode({ kind: 'enter' }); setErr('') }}>Order Food</button>
        <button className={`chip${gateTab === 'staff' && !isReset ? ' on' : ''}`} onClick={() => { setGateTab('staff'); setMode({ kind: 'enter' }); setErr('') }}>Staff Access</button>
      </div>

      {isReset ? (
        <div className="login-wrap">
          <div className="gate-lockmark" aria-hidden="true"><IconLock size={26} /></div>
          <h2 className="gate-heading">Set a new password</h2>
          <p className="gate-lead">Answer your security question to set a new password</p>
          <form onSubmit={submitReset} noValidate>
            {err && <div className="form-error show" role="alert">{err}</div>}
            <div className="field">
              <label htmlFor="gate-answer">Enter your gmail</label>
              <input id="gate-answer" name="answer" type="text" autoCapitalize="none" placeholder="Your answer" autoFocus />
            </div>
            <div className="field">
              <label htmlFor="gate-npw">New password</label>
              <input id="gate-npw" name="npw" type="password" autoComplete="new-password" placeholder="At least 4 characters" />
            </div>
            <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Set new password</button>
          </form>
          <div className="gate-alt">
            <button className="admin-link" onClick={() => { setMode({ kind: 'enter' }); setErr('') }}>
              <IconBack size={15} /> Back
            </button>
          </div>
          <Credits />
        </div>
      ) : gateTab === 'order' ? (
        <div className="scroll stack gate-order">
          <div className="gate-backrow">
            <button className="admin-link" onClick={() => setGateTab('welcome')}>
              <IconBack size={15} /> Back to Welcome
            </button>
          </div>
          <PublicOrder />
          <Credits />
        </div>
      ) : (
        <div className="login-wrap">
          <div className="gate-backrow">
            <button className="admin-link" onClick={() => { setGateTab('welcome'); setMode({ kind: 'enter' }); setErr('') }}>
              <IconBack size={15} /> Back to Welcome
            </button>
          </div>
          <div className="gate-lockmark" aria-hidden="true"><IconLock size={26} /></div>
          <h2 className="gate-heading">Syllabites staff access</h2>
          <p className="gate-lead">Enter the access password to continue</p>
          <form onSubmit={submitEnter} noValidate>
            {err && <div className="form-error show" role="alert">{err}</div>}
            <div className="field">
              <label htmlFor="gate-pw">Access password</label>
              <input id="gate-pw" name="pw" type="password" autoComplete="current-password" placeholder="••••••••" autoFocus aria-describedby="gate-pw-hint" />
              <div className="hint" id="gate-pw-hint">Shared password for all counters. Ask a volunteer if you don&apos;t know it.</div>
            </div>
            <button className={`btn btn-primary xl block${busy ? ' loading' : ''}`} disabled={busy}>Unlock</button>
          </form>
          <div className="gate-alt">
            <button className="admin-link" onClick={() => { setMode({ kind: 'reset' }); setErr('') }}>Forgot password?</button>
          </div>
          <Credits />
        </div>
      )}
    </div>
  )
}

function buzzIn() { try { navigator.vibrate?.(20) } catch {} }
function toastUnlock() { toast('Password updated', 'ok') }
