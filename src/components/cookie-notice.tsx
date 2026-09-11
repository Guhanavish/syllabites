'use client'

/* One-time storage notice. Syllabites runs no ads, no trackers, and no
   third-party analytics. The app only keeps functional data on the device
   (access-gate state, counter choice, cart, admin tab) plus the admin login
   cookie. This bar states that once and stays dismissed. */

import { useEffect, useState } from 'react'
import Link from 'next/link'

const KEY = 'fc.cookie.ok'

export function CookieNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true)
    } catch {
      setShow(true)
    }
  }, [])

  if (!show) return null

  function ok() {
    try { localStorage.setItem(KEY, '1') } catch {}
    setShow(false)
  }

  return (
    <div
      role="region"
      aria-label="Privacy notice"
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 'calc(var(--nav-h) + var(--sab) + 10px)',
        zIndex: 75,
        background: 'var(--ink)',
        color: '#fff',
        borderRadius: 16,
        padding: '12px 14px',
        boxShadow: 'var(--shadow-2)',
        fontSize: 12.5,
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      <div>
        Syllabites stores only what it needs on this device (access state, counter
        choice, cart). No ads, no trackers. See{' '}
        <Link href="/privacy" style={{ color: '#ffd9bd', fontWeight: 800 }}>
          Privacy
        </Link>
        .
      </div>
      <button className="btn sm" style={{ marginTop: 10, background: '#fff', color: 'var(--ink)', border: 0 }} onClick={ok}>
        Got it
      </button>
    </div>
  )
}
