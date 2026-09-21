'use client'

/* Shared UI primitives: toasts, confirm dialog, bottom sheet.
   Module-level store + useSyncExternalStore = zero-dependency,
   no provider needed. */

import { useSyncExternalStore } from 'react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

type Toast = { id: number; msg: string; kind: '' | 'ok' | 'bad' }
type SheetState = { open: boolean; content: ReactNode | null }
type ConfirmState = {
  open: boolean
  title: string
  msg: string
  yes: string
  no: string
  danger: boolean
} | null

let toasts: Toast[] = []
let sheet: SheetState = { open: false, content: null }
let confirmState: ConfirmState = null
let confirmResolve: ((v: boolean) => void) | null = null

const listeners = new Set<() => void>()
function emit() { listeners.forEach((l) => l()) }
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }

export function getToasts() { return toasts }
export function getSheet() { return sheet }
export function getConfirm() { return confirmState }

/* Jittered poller: same cadence as setInterval, but each device drifts on
   its own schedule so hundreds of phones never hammer the server in the
   same millisecond (thundering-herd guard). Skips hidden tabs. Returns
   a cleanup for useEffect. First tick fires after one jittered period;
   callers keep their immediate load() for first paint. */
export function every(ms: number, fn: () => void) {
  let alive = true
  let t: ReturnType<typeof setTimeout> | undefined
  const tick = () => {
    if (!alive) return
    if (typeof document === 'undefined' || !document.hidden) {
      try { fn() } catch {}
    }
    t = setTimeout(tick, ms * (0.85 + Math.random() * 0.3))
  }
  t = setTimeout(tick, ms * (0.85 + Math.random() * 0.3))
  return () => { alive = false; if (t) clearTimeout(t) }
}

/* Re-lock the gate so the Welcome hub renders again. Section, role,
   cart and tokens stay in storage; only the gate pass is forgotten. */
export function lockGate() {
  try { localStorage.removeItem('fc.gate') } catch {}
  try { window.dispatchEvent(new Event('fc:lock')) } catch {}
}

/* Orb companion moods. toast() auto-fires these so the orb reacts to
   every interaction with zero call-site changes; explicit orbSay() calls
   cover successes that don't toast (order placement). */
export type OrbMood = 'celebrate' | 'happy' | 'confused' | 'curious' | 'listening' | 'thinking' | 'searching' | 'working' | 'excited' | 'suspicious' | 'angry' | 'proud' | 'shy' | 'sad' | 'laughing' | 'scared' | 'playful'
export function orbSay(mood: OrbMood) {
  try { window.dispatchEvent(new CustomEvent('fc:orb-mood', { detail: mood })) } catch {}
}
/* Glide the orb next to a result element and stare at it for dwellMs. */
export function orbFocus(selector: string, mood: OrbMood, dwellMs = 4000) {
  try { window.dispatchEvent(new CustomEvent('fc:orb-focus', { detail: { selector, mood, dwellMs } })) } catch {}
}
/* Circle an element (parcel access code) for ~3s, then release. */
export function orbOrbit(selector: string, mood: OrbMood) {
  try { window.dispatchEvent(new CustomEvent('fc:orb-orbit', { detail: { selector, mood } })) } catch {}
}

export function toast(msg: string, kind: '' | 'ok' | 'bad' = '', ms = 2600) {
  const t: Toast = { id: Date.now() + Math.random(), msg, kind }
  toasts = [...toasts, t]
  emit()
  try {
    if (kind === 'ok') orbSay('happy')
    else if (kind === 'bad') orbSay('confused')
    else orbSay(msg.startsWith('New ') ? 'excited' : 'listening')
  } catch {}
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id)
    emit()
  }, ms)
}

export function openSheet(content: React.ReactNode) {
  sheet = { open: true, content }
  emit()
}
export function closeSheet() {
  if (!sheet.open) return
  sheet = { ...sheet, open: false }
  emit()
  setTimeout(() => { if (!sheet.open) { sheet = { open: false, content: null }; emit() } }, 360)
}

export function confirmBox(opts: { title?: string; msg?: string; yes?: string; no?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolve = resolve
    confirmState = {
      open: true,
      title: opts.title ?? 'Are you sure?',
      msg: opts.msg ?? '',
      yes: opts.yes ?? 'Confirm',
      no: opts.no ?? 'Cancel',
      danger: opts.danger ?? true,
    }
    emit()
  })
}
function settleConfirm(v: boolean) {
  confirmState = null
  const r = confirmResolve
  confirmResolve = null
  emit()
  r?.(v)
}

/* buzz + chime */
export function buzz(pattern: number | number[] = 15) {
  try { navigator.vibrate?.(pattern) } catch {}
}
let audioCtx: AudioContext | null = null
export function ensureAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)() } catch {} }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
}
if (typeof window !== 'undefined') {
  document.addEventListener('pointerdown', ensureAudio, { once: true, capture: true })
}
export function chime() {
  try {
    ensureAudio()
    if (!audioCtx) return
    const t0 = audioCtx.currentTime
    ;[[880, 0], [1174.7, 0.13]].forEach(([f, off]) => {
      const o = audioCtx!.createOscillator()
      const g = audioCtx!.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, t0 + off)
      g.gain.linearRampToValueAtTime(0.22, t0 + off + 0.02)
      g.gain.exponentialRampToValueAtTime(0.001, t0 + off + 0.5)
      o.connect(g); g.connect(audioCtx!.destination)
      o.start(t0 + off); o.stop(t0 + off + 0.55)
    })
  } catch {}
}

/* ---------- host component (mount once in layout) ---------- */
/** Reactive online flag so forms can disable submits while offline. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    setOnline(navigator.onLine)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return online
}
export function UiHost() {  const t = useSyncExternalStore(subscribe, getToasts, getToasts)
  const sh = useSyncExternalStore(subscribe, getSheet, getSheet)
  const cf = useSyncExternalStore(subscribe, getConfirm, getConfirm)
  const [online, setOnline] = useState(true)
  const wasOff = useRef(false)

  useEffect(() => {
    const up = () => { setOnline(true); if (wasOff.current) { wasOff.current = false; orbSay('happy') } }
    const down = () => { wasOff.current = true; setOnline(false); orbSay('scared') }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    setOnline(navigator.onLine)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  return (
    <>
      <div className={`backdrop${sh.open ? ' show' : ''}`} onClick={() => closeSheet()} />
      <div className="sheet-wrap">
        <div className={`sheet${sh.open ? ' open' : ''}`} role="dialog" aria-modal="true">{sh.content}</div>
      </div>
      <div className={`confirm-wrap${cf?.open ? ' show' : ''}`}>
        <div className="confirm-card">
          <h3>{cf?.title}</h3>
          <p>{cf?.msg}</p>
          <div className="confirm-actions">
            <button className="btn btn-ghost" onClick={() => settleConfirm(false)}>{cf?.no}</button>
            <button className={`btn ${cf?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => settleConfirm(true)}>{cf?.yes}</button>
          </div>
        </div>
      </div>
      <div className="toasts">
        {t.map((x) => (
          <div key={x.id} className={`toast${x.kind === 'ok' ? ' t-ok' : x.kind === 'bad' ? ' t-bad' : ''}`}>
            {x.kind === 'ok' ? '\u2713  ' : x.kind === 'bad' ? '\u26A0\uFE0F  ' : ''}{x.msg}
          </div>
        ))}
      </div>
      {!online && <div className="offline-bar show">⟳ You are offline, reconnecting…</div>}
    </>
  )
}
