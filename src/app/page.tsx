'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buzz } from '@/lib/ui'

type Section = 'boys' | 'girls' | null

export default function Landing() {
  const router = useRouter()
  const [section, setSection] = useState<Section>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try { setSection(localStorage.getItem('fc.section') as Section) } catch {}
  }, [])

  function pick(s: 'boys' | 'girls') {
    buzz(10)
    setSection(s)
    localStorage.setItem('fc.section', s)
  }

  async function go(role: 'sender' | 'receiver') {
    if (!section || busy) return
    setBusy(true)
    localStorage.setItem('fc.role', role)
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

      {section && (
        <div key={section}>
          <div className="landing-label">I am here to…</div>
          <div className="role-grid">
            <button className="role-btn" disabled={busy} onClick={() => go('sender')}>
              <span className="rb-ico">🧑‍🍳</span>
              <b>Order Sender</b>
              <small>Browse menu &amp; send food orders from your phone</small>
            </button>
            <button className="role-btn" disabled={busy} onClick={() => go('receiver')}>
              <span className="rb-ico">📋</span>
              <b>Order Receiver</b>
              <small>Counter view — receive &amp; manage live orders</small>
            </button>
          </div>
        </div>
      )}

      <div className="landing-foot">
        <button className="admin-link" onClick={() => router.push('/admin')}>
          🔐 Admin login
        </button>
      </div>
    </div>
  )
}
