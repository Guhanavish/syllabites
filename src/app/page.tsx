'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buzz } from '@/lib/ui'

type Section = 'boys' | 'girls' | null

export default function Landing() {
  const router = useRouter()
  const [section, setSection] = useState<Section>(null)
  const [busy, setBusy] = useState(false)
  const [showPwd, setShowPwd] = useState<Section>(null)
  const [pwd, setPwd] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)
  const [showRolePopup, setShowRolePopup] = useState<Section>(null)

  useEffect(() => {
    try { setSection(localStorage.getItem('fc.section') as Section) } catch {}
  }, [])

  function pick(s: 'boys' | 'girls') {
    buzz(10)
    setSection(s)
    localStorage.setItem('fc.section', s)
    setPwd(''); setPwdErr('')
    setShowPwd(s)
  }

  async function submitPwd(e: React.FormEvent) {
    e.preventDefault()
    if (!showPwd) return
    setPwdBusy(true); setPwdErr('')
    try {
      const res = await fetch('/api/section/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: showPwd, password: pwd })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.error || 'Wrong password')
      buzz(15)
      setShowPwd(null)
      setShowRolePopup(showPwd)
    } catch (ex: any) {
      setPwdErr(ex.message || 'Wrong password')
    } finally { setPwdBusy(false) }
  }

  async function go(role: 'sender' | 'receiver') {
    if (!showRolePopup || busy) return
    setBusy(true)
    localStorage.setItem('fc.section', showRolePopup)
    localStorage.setItem('fc.role', role)
    setSection(showRolePopup)
    buzz(15)
    router.push(role === 'sender' ? '/sender' : '/receiver')
  }

  return (
    <div className="landing">
      <div className="hero">
        <span className="float" style={{ top: 18, right: 22 }}>🥟</span>
        <span className="float" style={{ bottom: 16, right: 64, animationDelay: '1.4s' }}>🥤</span>
        <span className="float" style={{ top: 44, right: 120, animationDelay: '.7s' }}>🍚</span>
        <span className="logo">🍽️</span>
        <h1>Syllabites</h1>
        <p>The campus food court, reimagined — fresh orders, zero queue.</p>
      </div>

      <div className="landing-label">Choose your side</div>
      <div className="pick-grid">
        <button
          className={`pick-card pc-boys${section === 'boys' ? ' sel' : ''}`}
          onClick={() => pick('boys')}
        >
          <span className="pc-ico">👦</span><b>Boys</b><small>Boys counter</small>
        </button>
        <button
          className={`pick-card pc-girls${section === 'girls' ? ' sel' : ''}`}
          onClick={() => pick('girls')}
        >
          <span className="pc-ico">👧</span><b>Girls</b><small>Girls counter</small>
        </button>
      </div>

      <div className="landing-foot">
        <button className="admin-link" onClick={() => router.push('/admin')}>
          🔐 Admin login
        </button>
      </div>

      {/* Password popup */}
      {showPwd && (
        <div className="confirm-wrap show" style={{ zIndex: 70 }}>
          <div className="confirm-card" style={{ maxWidth: 360 }}>
            <h3>{showPwd === 'boys' ? '👦 Boys' : '👧 Girls'} password</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Enter the {showPwd} section password to continue.</p>
            <form onSubmit={submitPwd} noValidate style={{ marginTop: 14 }}>
              {pwdErr && <div className="form-error show">{pwdErr}</div>}
              <div className="field">
                <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} placeholder="Password" autoFocus />
              </div>
              <div className="confirm-actions">
                <button type="button" className="btn btn-ghost" onClick={()=>setShowPwd(null)}>Cancel</button>
                <button type="submit" className={`btn btn-primary${pwdBusy?' loading':''}`} disabled={pwdBusy}>Unlock</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role selection popup */}
      {showRolePopup && (
        <div className="confirm-wrap show" style={{ zIndex: 70 }}>
          <div className="confirm-card" style={{ maxWidth: 360 }}>
            <h3>{showRolePopup === 'boys' ? '👦 Boys' : '👧 Girls'} — choose role</h3>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>How will you use this device?</p>
            <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
              <button className="role-btn" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '14px 16px' }} disabled={busy} onClick={() => go('sender')}>
                <span className="rb-ico" style={{ fontSize: 28 }}>🧑‍🍳</span>
                <span><b>Order Sender</b><br /><small>Browse menu &amp; send orders</small></span>
              </button>
              <button className="role-btn" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '14px 16px' }} disabled={busy} onClick={() => go('receiver')}>
                <span className="rb-ico" style={{ fontSize: 28 }}>📋</span>
                <span><b>Order Receiver</b><br /><small>Counter view — manage orders</small></span>
              </button>
            </div>
            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button className="admin-link" onClick={()=>setShowRolePopup(null)}>← Back</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
