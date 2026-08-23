'use client'

import { useState } from 'react'
import { api, isSessionExpired } from '@/lib/client'
import { toast } from '@/lib/ui'

export function SettingsTab({ expired, onLogout }: { expired: (e: any) => boolean; onLogout: () => void }) {
  const [err, setErr] = useState('')

  async function changePw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setErr('')
    const cur = String(fd.get('cur') || '')
    const nw = String(fd.get('new') || '')
    const nw2 = String(fd.get('new2') || '')
    if (nw.length < 6) { setErr('New password needs at least 6 characters'); return }
    if (nw !== nw2) { setErr("The two new passwords don't match"); return }
    try {
      await api('/api/password', { method: 'POST', body: { currentPassword: cur, newPassword: nw } })
      toast('Password updated ✓', 'ok')
      e.currentTarget.reset()
    } catch (ex: any) {
      if (isSessionExpired(ex)) { expired(ex); return }
      setErr(ex.message || 'Could not update password')
    }
  }

  return (
    <>
      <div className="card pad" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="sec-chip" style={{ background: 'var(--ink)' }}>🔐</div>
          <div>
            <b>Administrator</b>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
              You can see everything — menu, stock &amp; both counters.
            </div>
          </div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>Change password</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          Use at least 6 characters. All other devices stay logged out after a change.
        </p>
        <form onSubmit={changePw} noValidate>
          {err && <div className="form-error show">{err}</div>}
          <div className="field">
            <label>Current password</label>
            <input type="password" name="cur" autoComplete="current-password" placeholder="••••••••" />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" name="new" autoComplete="new-password" placeholder="At least 6 characters" />
          </div>
          <div className="field">
            <label>Repeat new password</label>
            <input type="password" name="new2" autoComplete="new-password" placeholder="Same as above" />
          </div>
          <button className="btn btn-dark block">Update password</button>
        </form>
      </div>

      <div className="card settings-row" style={{ marginBottom: 14 }}>
        <div className="sr-ico">☁️</div>
        <div className="sr-main">
          <b>Cloud data</b>
          <small>All orders, sales and stock live in your Supabase database — safe and always in sync.</small>
        </div>
      </div>

      <button className="btn soft-bad xl block" onClick={onLogout}>Log out of admin 🚪</button>
    </>
  )
}
