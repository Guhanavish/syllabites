'use client'

import { useCallback, useEffect, useState } from 'react'
import { api, isSessionExpired } from '@/lib/client'
import { toast } from '@/lib/ui'
import { confirmBox } from '@/lib/ui'

type Backup = { id: number; label: string; createdAt: string; items: number; orders: number }

export function SettingsTab({ expired, onLogout }: { expired: (e: any) => boolean; onLogout: () => void }) {
  const [err, setErr] = useState('')
  const [username, setUsername] = useState('')
  const [backups, setBackups] = useState<Backup[]>([])

  const loadBackups = useCallback(async () => {
    try {
      const list = await api<Backup[]>('/api/admin/backups')
      setBackups(Array.isArray(list) ? list : [])
    } catch (e: any) { expired(e) }
  }, [expired])

  useEffect(() => { loadBackups() }, [loadBackups])

  async function changeUsername(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('u') || '').trim()
    if (!name) return
    try {
      await api('/api/admin/username', { method: 'POST', body: { newUsername: name } })
      toast(`Username changed to "${name}" ✓`, 'ok')
      e.currentTarget.reset()
    } catch (ex: any) {
      if (isSessionExpired(ex)) { expired(ex); return }
      toast(ex.message || 'Could not change username', 'bad')
    }
  }

  async function changeGatePw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pw = String(new FormData(e.currentTarget).get('gpw') || '')
    try {
      await api('/api/admin/gate-password', { method: 'POST', body: { newPassword: pw } })
      toast('Access password updated — other devices must re-enter it', 'ok')
      e.currentTarget.reset()
    } catch (ex: any) {
      if (isSessionExpired(ex)) { expired(ex); return }
      toast(ex.message || 'Could not update password', 'bad')
    }
  }

  async function changeSectionPw(section: 'boys' | 'girls', e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const pw = String(new FormData(e.currentTarget).get('spw') || '')
    try {
      await api('/api/admin/section-password', { method: 'POST', body: { section, newPassword: pw } })
      toast(`${section === 'boys' ? 'Boys' : 'Girls'} password updated ✓`, 'ok')
      e.currentTarget.reset()
    } catch (ex: any) {
      if (isSessionExpired(ex)) { expired(ex); return }
      toast(ex.message || 'Could not update password', 'bad')
    }
  }

  const [offer, setOffer] = useState<any>(null)
  const loadOffer = useCallback(async () => {
    try { setOffer(await api('/api/admin/offer/status')) } catch {}
  }, [])
  useEffect(() => { loadOffer() }, [loadOffer])
  async function startOffer() {
    try {
      const r = await api('/api/admin/offer/start', { method: 'POST' })
      toast('Offer started — 2 lucky orders will get 5-10% off! 🎉', 'ok')
      loadOffer()
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
  }

  async function changeAdminPw(e: React.FormEvent<HTMLFormElement>) {
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

  async function createBackup() {
    try {
      const r = await api<{ backupId?: number; id?: number }>('/api/admin/backups/create', {
        method: 'POST', body: { label: 'Manual backup' },
      })
      toast(`Backup #${r.backupId ?? r.id} saved on the server ✓`, 'ok')
      loadBackups()
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
  }

  async function resetAll() {
    const ok = await confirmBox({
      title: 'Start completely fresh?',
      msg: 'Menu, orders and sales will be backed up on the server first, then wiped. Admin login stays as is.',
      yes: 'Back up & wipe',
    })
    if (!ok) return
    try {
      const r = await api<{ backupId: number; backedUpItems: number; backedUpOrders: number }>('/api/admin/reset', {
        method: 'POST', body: { label: 'Fresh start' },
      })
      toast(`Saved as backup #${r.backupId} (${r.backedUpItems} items, ${r.backedUpOrders} orders) then wiped ✓`, 'ok', 5000)
      loadBackups()
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
  }

  async function importBackup(b: Backup) {
    const ok = await confirmBox({
      title: `Import backup #${b.id}?`,
      msg: 'Current data is backed up automatically first — nothing can be lost. Then menu/orders/sales are replaced with this backup.',
      yes: 'Back up now & import',
      danger: false,
    })
    if (!ok) return
    try {
      const r = await api<{ safetyBackupId: number; items: number; orders: number }>('/api/admin/backups/restore', {
        method: 'POST', body: { id: b.id },
      })
      toast(`Imported ${r.items} items & ${r.orders} orders · current data saved as backup #${r.safetyBackupId}`, 'ok', 6000)
      loadBackups()
    } catch (e: any) { if (!expired(e)) toast(e.message, 'bad') }
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

      {/* ---- admin login name ---- */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>Login name</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          The user ID you type on the admin login screen.
        </p>
        <form onSubmit={changeUsername} noValidate>
          <div className="field">
            <input name="u" type="text" autoCapitalize="none" placeholder="New user ID" autoComplete="off" />
          </div>
          <button className="btn btn-dark block">Change login name</button>
        </form>
      </div>

      {/* ---- gate password ---- */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>App access password</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          The common password everyone types before opening Syllabites. Changing it locks every device until they re-enter it.
        </p>
        <form onSubmit={changeGatePw} noValidate>
          <div className="field">
            <input name="gpw" type="password" autoComplete="new-password" placeholder="New access password (min 4)" />
          </div>
          <button className="btn btn-dark block">Update access password</button>
        </form>
        <p style={{ color: 'var(--muted)', fontSize: 11.5, fontWeight: 600, marginTop: 10 }}>
          Forgot it? Use “Forgot password?” on the lock screen → answer your security question.
        </p>
      </div>

      {/* ---- section passwords ---- */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>Boys / Girls section passwords</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          Separate passwords for each counter. Only admin can change them. Current defaults: Boys <code>boyzz</code>, Girls <code>girls</code>.
        </p>
        <form onSubmit={(e) => changeSectionPw('boys', e)} noValidate style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}><label>Boys password</label><input name="spw" type="password" placeholder="New boys password" /></div>
          <button className="btn btn-dark" style={{ height: 48 }}>Update</button>
        </form>
        <form onSubmit={(e) => changeSectionPw('girls', e)} noValidate style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}><label>Girls password</label><input name="spw" type="password" placeholder="New girls password" /></div>
          <button className="btn btn-dark" style={{ height: 48 }}>Update</button>
        </form>
      </div>

      {/* ---- discount offer (public orders only) ---- */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>🎁 Public order discount offer</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          5-10% off on 2 random orders out of 50 (4% chance). Only for entrance (public) orders. Click Start to activate.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <button className="btn btn-primary" onClick={startOffer}>🚀 Start Offer (2/50)</button>
          <button className="btn btn-ghost" onClick={loadOffer}>↻ Status</button>
        </div>
        {offer && (
          <div style={{ background: 'var(--bg-soft)', borderRadius: 12, padding: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800 }}>Status: {offer.active ? '🟢 Active' : '⚪ Inactive'} · Remaining: {offer.remaining} / 2</div>
            {offer.discountedOrders?.length ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 6 }}>Report — discounted orders:</div>
                {offer.discountedOrders.map((d: any) => (
                  <div key={d.code} className="alert-row" style={{ padding: '8px 0' }}>
                    <span className="alert-emoji">🎟️</span>
                    <span className="alert-name">
                      Code <b>{d.code}</b> — {d.customerName} ({d.customerClass}) · {d.discountPercent}% off
                      <br /><small style={{ color: 'var(--muted)' }}>{d.originalTotal ? `${((d.originalTotal)/100).toFixed(2)} → ${(d.total/100).toFixed(2)}` : ''} · Saved {d.discountAmount ? (d.discountAmount/100).toFixed(2) : ''}</small>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 8 }}>No discounted orders yet.</div>
            )}
          </div>
        )}
      </div>

      {/* ---- admin password ---- */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>Admin password</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          Only for the admin panel. All other devices stay logged out after a change.
        </p>
        <form onSubmit={changeAdminPw} noValidate>
          {err && <div className="form-error show">{err}</div>}
          <div className="field"><input type="password" name="cur" autoComplete="current-password" placeholder="Current password" /></div>
          <div className="field"><input type="password" name="new" autoComplete="new-password" placeholder="New password (min 6)" /></div>
          <div className="field"><input type="password" name="new2" autoComplete="new-password" placeholder="Repeat new password" /></div>
          <button className="btn btn-dark block">Update password</button>
        </form>
      </div>

      {/* ---- backups / fresh start ---- */}
      <div className="card pad" style={{ marginBottom: 14 }}>
        <b style={{ fontSize: 15 }}>Data &amp; backups</b>
        <p style={{ color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, margin: '4px 0 14px' }}>
          Resetting always saves a full backup on the server first. Importing a backup always saves the current
          data before anything changes — nothing is ever lost.
        </p>
        <button className="btn btn-ghost block" onClick={createBackup}>💾 Save a backup now</button>

        <div style={{ marginTop: 14 }}>
          {!backups.length ? (
            <small style={{ color: 'var(--muted)', fontWeight: 600 }}>No backups yet.</small>
          ) : backups.map((b) => (
            <div key={b.id} className="alert-row">
              <span className="alert-emoji">🗄️</span>
              <span className="alert-name">
                #{b.id} · {b.label}
                <br />
                <small style={{ color: 'var(--muted)' }}>
                  {new Date(b.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  {' · '}{b.items} items · {b.orders} orders
                </small>
              </span>
              <button className="btn sm ghost" onClick={() => importBackup(b)}>Import</button>
            </div>
          ))}
        </div>

        <button className="btn soft-bad xl block" style={{ marginTop: 16 }} onClick={resetAll}>
          🧹 Back up everything &amp; start fresh
        </button>
      </div>

      <div className="card settings-row" style={{ marginBottom: 14 }}>
        <div className="sr-ico">☁️</div>
        <div className="sr-main">
          <b>Cloud data</b>
          <small>All orders, sales and stock live in your Supabase database — safe across restarts and code updates.</small>
        </div>
      </div>

      <button className="btn soft-bad xl block" onClick={onLogout}>Log out of admin 🚪</button>
    </>
  )
}
