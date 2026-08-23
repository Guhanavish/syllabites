'use client'

/* Shared UI primitives: toasts, confirm dialog, bottom sheet.
   Module-level store + useSyncExternalStore = zero-dependency,
   no provider needed. */

import { useSyncExternalStore } from 'react'
import { useEffect, useState, type ReactNode } from 'react'

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

export function toast(msg: string, kind: '' | 'ok' | 'bad' = '', ms = 2600) {
  const t: Toast = { id: Date.now() + Math.random(), msg, kind }
  toasts = [...toasts, t]
  emit()
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
export function UiHost() {
  const t = useSyncExternalStore(subscribe, getToasts, getToasts)
  const sh = useSyncExternalStore(subscribe, getSheet, getSheet)
  const cf = useSyncExternalStore(subscribe, getConfirm, getConfirm)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
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
      {!online && <div className="offline-bar show">⟳ You are offline — reconnecting…</div>}
    </>
  )
}
