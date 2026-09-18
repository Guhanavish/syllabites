'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buzz, lockGate } from '@/lib/ui'
import { SiteFooter } from '@/components/site-chrome'
import { BrandHero } from '@/components/brand'
import { IconBack, IconLock, IconReceipt, IconBox, IconCheck } from '@/components/icons'

type Section = 'boys' | 'girls' | null
type Step = 'section' | 'password' | 'role'

export default function Landing() {
  const router = useRouter()
  const [section, setSection] = useState<Section>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState<Step>('section')
  const [pwd, setPwd] = useState('')
  const [pwdErr, setPwdErr] = useState('')
  const [pwdBusy, setPwdBusy] = useState(false)

  useEffect(() => {
    try { setSection(localStorage.getItem('fc.section') as Section) } catch {}
  }, [])

  /* Warm the two role routes so the post-unlock jump paints instantly. */
  useEffect(() => {
    try { router.prefetch('/sender'); router.prefetch('/receiver') } catch {}
  }, [router])

  function pick(s: 'boys' | 'girls') {
    buzz(10)
    setSection(s)
    setPwd(''); setPwdErr('')
    setStep('password')
  }

  async function submitPwd(e: React.FormEvent) {
    e.preventDefault()
    if (!section) return
    if (!pwd) { setPwdErr('Enter the section password to continue'); return }
    setPwdBusy(true); setPwdErr('')
    try {
      const res = await fetch('/api/section/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section, password: pwd })
      })
      const data = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(data.error || 'Wrong password')
      buzz(15)
      try { localStorage.setItem('fc.section', section) } catch {}
      setPwd(''); setPwdErr('')
      setStep('role')
    } catch (ex: any) {
      setPwdErr(ex.message || 'Wrong password')
    } finally { setPwdBusy(false) }
  }

  /* The Welcome hub only renders while the gate is locked, so going
     there re-locks this device. Section and role stay. */
  function goWelcome() {
    buzz(10)
    lockGate()
    router.push('/')
  }

  async function go(role: 'sender' | 'receiver') {
    if (!section || busy) return
    setBusy(true)
    localStorage.setItem('fc.section', section)
    localStorage.setItem('fc.role', role)
    buzz(15)
    router.push(role === 'sender' ? '/sender' : '/receiver')
  }

  return (
    <div className="landing">
      <BrandHero title="Syllabites" sub="Order from your counter and pick up by number. No standing in line." />

      {step === 'section' && (
        <section className="entry-panel" aria-labelledby="entry-choose">
          <div className="entry-intro">
            <h2 id="entry-choose">Choose your counter</h2>
            <p>Pick the counter whose live menu and order queue this device will join.</p>
          </div>
          <div className="pick-grid" role="group" aria-label="Counter sections">
            <button
              className={`pick-card pc-boys${section === 'boys' ? ' sel' : ''}`}
              onClick={() => pick('boys')}
              aria-pressed={section === 'boys'}
            >
              <span className="pc-ico" aria-hidden="true"><IconReceipt size={22} /></span>
              <b>Boys</b>
              <small>Boys counter menu</small>
            </button>
            <button
              className={`pick-card pc-girls${section === 'girls' ? ' sel' : ''}`}
              onClick={() => pick('girls')}
              aria-pressed={section === 'girls'}
            >
              <span className="pc-ico" aria-hidden="true"><IconBox size={22} /></span>
              <b>Girls</b>
              <small>Girls counter menu</small>
            </button>
          </div>
        </section>
      )}

      {step === 'password' && section && (
        <section className="entry-panel" aria-labelledby="entry-password">
          <div className="entry-intro">
            <button type="button" className="entry-back" onClick={() => { setSection(null); setStep('section') }}>
              <IconBack size={16} /> All counters
            </button>
            <h2 id="entry-password">{section === 'boys' ? 'Boys' : 'Girls'} counter password</h2>
            <p>Enter the {section} section password to continue.</p>
          </div>
          <form onSubmit={submitPwd} noValidate>
            {pwdErr && <div className="form-error show" role="alert">{pwdErr}</div>}
            <div className="field">
              <label htmlFor="section-pwd">{section === 'boys' ? 'Boys' : 'Girls'} counter password</label>
              <input
                id="section-pwd"
                type="password"
                value={pwd}
                onChange={e=>setPwd(e.target.value)}
                placeholder="Section password"
                autoComplete="current-password"
                autoFocus
                aria-describedby="section-pwd-hint"
              />
              <div className="hint" id="section-pwd-hint">Ask a volunteer at the counter if you don&apos;t know it.</div>
            </div>
            <button type="submit" className={`btn btn-primary xl block${pwdBusy ? ' loading' : ''}`} disabled={pwdBusy}>
              Unlock counter
            </button>
          </form>
        </section>
      )}

      {step === 'role' && section && (
        <section className="entry-panel" aria-labelledby="entry-role">
          <div className="entry-intro">
            <button type="button" className="entry-back" onClick={() => { setPwd(''); setPwdErr(''); setStep('password') }}>
              <IconBack size={16} /> Back to password
            </button>
            <h2 id="entry-role">{section === 'boys' ? 'Boys' : 'Girls'} counter unlocked</h2>
            <p>How will you use this device?</p>
          </div>
          <p className="entry-ok" role="status">
            <IconCheck size={16} /> Counter password verified
          </p>
          <div className="role-list">
            <button className="role-btn role-btn-sender" disabled={busy} onClick={() => go('sender')}>
              <span className="rb-ico" aria-hidden="true"><IconReceipt size={24} /></span>
              <span className="rb-main"><b>Order Sender</b><small>Browse the menu and send orders</small></span>
              <span className="rb-go" aria-hidden="true"><IconBack size={16} /></span>
            </button>
            <button className="role-btn role-btn-receiver" disabled={busy} onClick={() => go('receiver')}>
              <span className="rb-ico" aria-hidden="true"><IconBox size={24} /></span>
              <span className="rb-main"><b>Order Receiver</b><small>Counter view for managing orders</small></span>
              <span className="rb-go" aria-hidden="true"><IconBack size={16} /></span>
            </button>
          </div>
        </section>
      )}

      <div className="landing-foot" style={{ gap: 10, flexWrap: 'wrap' }}>
        <button className="admin-link" onClick={goWelcome}>
          <IconLock size={15} /> Welcome page
        </button>
        <button className="admin-link" onClick={() => router.push('/admin')}>
          <IconLock size={15} /> Admin login
        </button>
      </div>
      <SiteFooter />
    </div>
  )
}

