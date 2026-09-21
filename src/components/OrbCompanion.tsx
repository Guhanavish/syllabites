'use client'

/* Syllabi — global orb companion. One instance for the whole app, mounted
   in the root layout. The avatar engine drives the DOM directly, so it is
   created inside an effect (never SSR) and renders identical empty divs on
   server and first client pass: no hydration mismatch by construction.
   - REAL EYES: the engine renders pupils as two SVG paths and rewrites
     only their `d`/`fill`/`opacity` each frame — never `transform`. We own
     `transform`, shifting pupils toward the cursor (desktop), the last
     touch point, or a focused result. The body never leans.
   - LOOK THEN REACT: every tap first turns the orb toward the point
     (directional glance via smooth setExpression), then plays the
     function-mapped reaction (`data-orb` buttons, toast auto-moods,
     explicit orbSay calls).
   - FOCUS RESULTS: orbFocus(selector, mood, dwell) glides the orb next to
     a result element and stares at it; orbOrbit(selector, mood) circles an
     element (the parcel access code) for ~3s.
   - Roams to a random free spot anywhere in the phone column on page
     interaction. Touching the orb: surprised -> playful hop + jump.
   - Idleness escalates idle -> bored -> drowsy -> sleeping; waking on
     return; shy on gate lock. Hidden tabs pause everything; reduced-motion
     renders a static orb. */

import { useEffect, useRef } from 'react'
import type { AnimationKey, AvatarController, ExpressionKey } from '@bible-strong/avatar-web'
import definition from './orb/syllabi.avatar.json'

const BASE: AnimationKey = 'idle'
const MOVE_GAP = 1500
const REVERT_MS = 3200
const REACT_DELAY = 450
const BORED_MS = 30000
const DROWSY_MS = 60000
const SLEEP_MS = 90000
const PUPIL_MAX = 10

/* Every animation in the definition, keyed by mood name. */
const MOOD_ANIM: Record<string, AnimationKey> = {
  sleeping: 'sleeping', waking: 'waking', idle: 'idle', listening: 'listening',
  thinking: 'thinking', searching: 'searching', working: 'working',
  excited: 'excited', bored: 'bored', suspicious: 'suspicious', angry: 'angry',
  drowsy: 'drowsy', happy: 'happy', curious: 'curious', confused: 'confused',
  surprised: 'surprised', proud: 'proud', shy: 'shy', sad: 'sad',
  laughing: 'laughing', scared: 'scared', playful: 'playful', celebrate: 'celebrate',
}

type FocusDetail = { selector: string; mood: string; dwellMs: number }
type OrbitDetail = { selector: string; mood: string }

export function OrbCompanion() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const mount = mountRef.current
    if (!root || !mount) return
    let ctrl: AvatarController | null = null
    let dead = false
    let lastMove = 0
    let hiddenAt = 0
    let focusUntil = 0
    let cur = { x: 0, y: 0 }
    let gaze = { x: 0, y: 0 }
    let gazeT = { x: 0, y: 0 }
    let mouse: { x: number; y: number } | null = null
    let eyes: SVGPathElement[] = []
    let raf = 0
    let revertT: ReturnType<typeof setTimeout> | undefined
    let moodT: ReturnType<typeof setTimeout> | undefined
    let boredT: ReturnType<typeof setTimeout> | undefined
    let drowsyT: ReturnType<typeof setTimeout> | undefined
    let sleepT: ReturnType<typeof setTimeout> | undefined
    let releaseT: ReturnType<typeof setTimeout> | undefined
    let orbitTs: ReturnType<typeof setTimeout>[] = []
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(pointer:fine)').matches

    const play = (a: AnimationKey) => { try { ctrl?.play(a) } catch {} }
    const glance = (a: ExpressionKey) => { try { ctrl?.setExpression(a) } catch {} }
    const clearTimers = () => {
      for (const t of [revertT, moodT, boredT, drowsyT, sleepT, releaseT]) if (t) clearTimeout(t)
      for (const t of orbitTs) clearTimeout(t)
      revertT = moodT = boredT = drowsyT = sleepT = releaseT = undefined
      orbitTs = []
    }
    const scheduleRevert = (ms = REVERT_MS) => {
      if (revertT) clearTimeout(revertT)
      revertT = setTimeout(() => { if (!dead) play(BASE) }, ms)
    }
    const pokeIdle = () => {
      if (boredT) clearTimeout(boredT)
      if (drowsyT) clearTimeout(drowsyT)
      if (sleepT) clearTimeout(sleepT)
      boredT = setTimeout(() => { if (!dead) play('bored') }, BORED_MS)
      drowsyT = setTimeout(() => { if (!dead) play('drowsy') }, DROWSY_MS)
      sleepT = setTimeout(() => { if (!dead) play('sleeping') }, SLEEP_MS)
    }
    const react = (mood: string) => {
      const anim = MOOD_ANIM[mood]
      if (!anim || reduced) return
      play(anim)
      scheduleRevert()
      pokeIdle()
    }
    const onMood = (e: Event) => react((e as CustomEvent<string>).detail)
    const onLock = () => react('shy')

    const orbCenter = () => {
      const r = root.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    /* Directional glance toward a screen point: the "turn to see" beat. */
    const glanceFor = (dx: number, dy: number): ExpressionKey =>
      (Math.abs(dx) > Math.abs(dy)
        ? dx > 0 ? 'far-right-glance' : 'curious-left'
        : dy > 0 ? 'downward-gaze' : 'upward-side-glance') as ExpressionKey
    /* Aim pupils (SVG units, clipped by the head clip-path) at a point. */
    const aimPupils = (x: number, y: number) => {
      const c = orbCenter()
      const dx = x - c.x, dy = y - c.y
      const d = Math.hypot(dx, dy) || 1
      const m = Math.min(1, d / 240) * PUPIL_MAX
      gazeT = { x: (dx / d) * m, y: (dy / d) * m }
    }
    const facePoint = (x: number, y: number) => {
      if (reduced || !ctrl) return
      const c = orbCenter()
      aimPupils(x, y)
      glance(glanceFor(x - c.x, y - c.y))
    }

    /* Random free spot anywhere in the phone column, far from current. */
    const roam = () => {
      const phone = root.parentElement
      const phoneW = phone?.clientWidth || 380
      const phoneH = phone?.clientHeight || 700
      const maxX = Math.max(0, phoneW - 24 - root.offsetWidth)
      const maxUp = Math.max(120, phoneH - root.offsetHeight - 190 - 100)
      let nx = cur.x, ny = cur.y
      for (let i = 0; i < 8; i++) {
        nx = Math.round(Math.random() * maxX)
        ny = -Math.round(Math.random() * maxUp)
        if (Math.hypot(nx - cur.x, ny - cur.y) > 140) break
      }
      cur = { x: nx, y: ny }
      root.style.transform = `translate3d(${nx}px,${ny}px,0)`
    }
    const hop = () => {
      try {
        mount.animate(
          [
            { transform: 'scale(1,1)' },
            { transform: 'scale(1.18,.82)' },
            { transform: 'scale(.94,1.06) translateY(-16px)' },
            { transform: 'scale(1,1) translateY(0)' },
          ],
          { duration: 480, easing: 'cubic-bezier(.3,.7,.3,1)' }
        )
      } catch {}
    }

    /* Glide next to an element and stare at its center. */
    const focusEl = (el: Element, mood: string, dwellMs: number) => {
      const phone = root.parentElement
      if (!phone) return
      const pr = phone.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      const s = root.offsetWidth || 84
      const maxX = Math.max(0, pr.width - 24 - s)
      const maxUp = Math.max(120, pr.height - s - 190 - 100)
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      /* Prefer right of the element, else left, else above. */
      let tx = er.right - pr.left + 14 - 12
      if (tx > maxX) tx = er.left - pr.left - s - 14 - 12
      tx = clamp(tx, -12, maxX)
      /* ty from layout bottom edge: center orb on element center. The 184
         mirrors the CSS base (nav 62 + safe-area + 122px lift). */
      const layoutCenterY = pr.bottom - 184 - s / 2
      const ty = clamp(er.top + er.height / 2 - layoutCenterY, -maxUp, 0)
      cur = { x: Math.round(tx), y: Math.round(ty) }
      root.style.transform = `translate3d(${cur.x}px,${cur.y}px,0)`
      lastMove = Date.now()
      facePoint(er.left + er.width / 2, er.top + er.height / 2)
      react(mood)
      focusUntil = Date.now() + dwellMs
      if (releaseT) clearTimeout(releaseT)
      releaseT = setTimeout(() => { if (!dead) { focusUntil = 0; play(BASE); pokeIdle() } }, dwellMs)
    }
    const onFocus = (e: Event) => {
      const d = (e as CustomEvent<FocusDetail>).detail
      if (!d?.selector || reduced) return
      const el = root.parentElement?.querySelector(d.selector) ?? document.querySelector(d.selector)
      if (el) focusEl(el, d.mood || 'happy', d.dwellMs || 4000)
      else react(d.mood || 'happy')
    }
    /* Circle an element (parcel access code) for ~3s, then release. */
    const onOrbit = (e: Event) => {
      const d = (e as CustomEvent<OrbitDetail>).detail
      if (!d?.selector || reduced) return
      const phone = root.parentElement
      const el = phone?.querySelector(d.selector) ?? document.querySelector(d.selector)
      if (!el || !phone) { react(d.mood || 'celebrate'); return }
      const pr = phone.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      const s = root.offsetWidth || 84
      const maxX = Math.max(0, pr.width - 24 - s)
      const maxUp = Math.max(120, pr.height - s - 190 - 100)
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      const layoutCenterY = pr.bottom - 184 - s / 2
      const toT = (cx: number, cy: number) => ({
        x: clamp(Math.round(cx - (pr.left + 12 + s / 2)), -12, maxX),
        y: clamp(Math.round(cy - layoutCenterY), -maxUp, 0),
      })
      const spots = [
        toT(er.left + er.width / 2, er.top - s / 2 - 14),
        toT(er.right + s / 2 + 14, er.top + er.height / 2),
        toT(er.left - s / 2 - 14, er.top + er.height / 2),
      ]
      const cc = { x: er.left + er.width / 2, y: er.top + er.height / 2 }
      for (const t of orbitTs) clearTimeout(t)
      orbitTs = []
      if (releaseT) clearTimeout(releaseT)
      focusUntil = Date.now() + 3300
      react(d.mood || 'celebrate')
      spots.forEach((p, i) => {
        orbitTs.push(setTimeout(() => {
          if (dead) return
          cur = p
          root.style.transform = `translate3d(${p.x}px,${p.y}px,0)`
          if (i) hop()
          facePoint(cc.x, cc.y)
          lastMove = Date.now()
        }, i * 1000))
      })
      releaseT = setTimeout(() => { if (!dead) { focusUntil = 0; play(BASE); pokeIdle() } }, 3300)
      pokeIdle()
    }

    const onInteract = (e: Event) => {
      if (reduced || dead) return
      pokeIdle()
      const pe = e as PointerEvent
      const hasPoint = typeof pe.clientX === 'number'
      const px = pe.clientX ?? 0
      const py = pe.clientY ?? 0
      /* Touched the orb itself: cute reaction + hop somewhere new. */
      if (e.target instanceof Node && root.contains(e.target)) {
        play('surprised')
        gazeT = { x: 0, y: 0 }
        hop()
        roam()
        lastMove = Date.now()
        scheduleRevert(2600)
        setTimeout(() => { if (!dead) play('playful') }, 900)
        return
      }
      /* Look at the touched point, then react to the button's function. */
      let mood = 'curious'
      if (e.target instanceof Element) {
        const tagged = e.target.closest('[data-orb]')
        const want = tagged?.getAttribute('data-orb')
        if (want && MOOD_ANIM[want]) mood = want
      }
      if (hasPoint && px + py > 0) facePoint(px, py)
      else play('curious')
      if (moodT) clearTimeout(moodT)
      moodT = setTimeout(() => { if (!dead) react(mood) }, hasPoint ? REACT_DELAY : 0)
      const now = Date.now()
      if (now - lastMove < MOVE_GAP || now < focusUntil) return
      lastMove = now
      roam()
    }
    const onVis = () => {
      if (dead) return
      try {
        if (document.hidden) {
          hiddenAt = Date.now()
          ctrl?.pause()
        } else if (!reduced) {
          play(hiddenAt && Date.now() - hiddenAt > 8000 ? 'waking' : BASE)
          scheduleRevert()
          pokeIdle()
        }
      } catch {}
    }

    /* Pupil loop: ease pupils toward their target; on desktop with no
       recent touch, the target tracks the cursor. Renderer owns d/fill,
       we own transform — no fighting. */
    const onMouse = (e: MouseEvent) => { mouse = { x: e.clientX, y: e.clientY } }
    const pupilLoop = () => {
      if (dead) return
      if (!document.hidden && ctrl && eyes.length) {
        try {
          if (finePointer && mouse) {
            const c = orbCenter()
            const dx = mouse.x - c.x, dy = mouse.y - c.y
            const d = Math.hypot(dx, dy) || 1
            const m = Math.min(1, d / 200) * PUPIL_MAX
            /* Touch-aimed gaze decays back to cursor watch. */
            gazeT = { x: gazeT.x + ((dx / d) * m - gazeT.x) * 0.06, y: gazeT.y + ((dy / d) * m - gazeT.y) * 0.06 }
          } else {
            /* Touch devices: aimed gaze relaxes back to center. */
            gazeT = { x: gazeT.x * 0.99, y: gazeT.y * 0.99 }
          }
          gaze = { x: gaze.x + (gazeT.x - gaze.x) * 0.2, y: gaze.y + (gazeT.y - gaze.y) * 0.2 }
          if (Math.abs(gaze.x) + Math.abs(gaze.y) > 0.05) {
            const t = `translate(${gaze.x.toFixed(2)} ${gaze.y.toFixed(2)})`
            for (const p of eyes) p.setAttribute('transform', t)
          } else if (eyes[0]?.getAttribute('transform')) {
            for (const p of eyes) p.removeAttribute('transform')
          }
        } catch {}
      }
      raf = requestAnimationFrame(pupilLoop)
    }

    let cancelled = false
    import('@bible-strong/avatar-web').then((m) => {
      if (cancelled || dead) return
      try {
        ctrl = reduced
          ? m.createAvatar(mount, { definition, defaultExpression: 'neutral', autoplay: false, size: '100%', ariaLabel: 'Syllabi' })
          : m.createAvatar(mount, { definition, defaultAnimation: BASE, size: '100%', ariaLabel: 'Syllabi, your canteen companion' })
        mount.querySelector('.orb-fallback')?.remove()
        const g = mount.querySelector('svg g')
        if (g) eyes = Array.from(g.querySelectorAll('path')) as SVGPathElement[]
      } catch { ctrl = null }
      if (!reduced) {
        pokeIdle()
        raf = requestAnimationFrame(pupilLoop)
      }
    }).catch(() => { ctrl = null })

    window.addEventListener('fc:orb-mood', onMood)
    window.addEventListener('fc:orb-focus', onFocus)
    window.addEventListener('fc:orb-orbit', onOrbit)
    window.addEventListener('fc:lock', onLock)
    document.addEventListener('pointerdown', onInteract, { capture: true, passive: true })
    document.addEventListener('scroll', onInteract, { capture: true, passive: true })
    document.addEventListener('visibilitychange', onVis)
    if (finePointer && !reduced) window.addEventListener('mousemove', onMouse, { passive: true })

    return () => {
      dead = true
      cancelled = true
      clearTimers()
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('fc:orb-mood', onMood)
      window.removeEventListener('fc:orb-focus', onFocus)
      window.removeEventListener('fc:orb-orbit', onOrbit)
      window.removeEventListener('fc:lock', onLock)
      window.removeEventListener('mousemove', onMouse)
      document.removeEventListener('pointerdown', onInteract, { capture: true } as EventListenerOptions)
      document.removeEventListener('scroll', onInteract, { capture: true } as EventListenerOptions)
      document.removeEventListener('visibilitychange', onVis)
      try { ctrl?.destroy() } catch {}
      ctrl = null
    }
  }, [])

  return (
    <div ref={rootRef} className="orb-companion" aria-hidden="true">
      <div ref={mountRef} className="orb-stage">
        {/* Fallback face: paints instantly (SSR too) and stays if the
            engine ever fails — removed once the avatar mounts. */}
        <div className="orb-fallback">
          <span className="orb-eye left" />
          <span className="orb-eye right" />
        </div>
      </div>
    </div>
  )
}
