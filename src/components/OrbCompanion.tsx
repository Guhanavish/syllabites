'use client'

/* Syllabi — native orb companion. Zero dependencies, ~7KB, plain SVG + a
   single rAF loop. Renders its full face in SSR HTML (identical on server
   and first client pass: no hydration mismatch, visible in first paint).
   - Full mood vocabulary (23): each mood is a parameter preset; the loop
     eases current params toward the target (~400ms transitions), with
     procedural bob, sway, blink tiers and squash-and-stretch.
   - REAL EYES: two pupil ellipses positioned directly in SVG units toward
     the cursor (desktop), the last touch point, or a focused result.
   - LOOK THEN REACT: every tap first turns the orb toward the point
     (rotate + aim pupils), then plays the function-mapped reaction from
     `data-orb` buttons, toast auto-moods, or explicit orbSay() calls.
   - FOCUS RESULTS: orbFocus(selector, mood, dwell) glides next to a result
     and stares; orbOrbit(selector, mood) circles an element ~3s.
   - Roams randomly anywhere in the phone column; touch = surprised hop +
     playful jump. Idle escalates idle -> bored -> drowsy -> sleeping;
     waking on return; shy on gate lock. Hidden tabs pause; reduced-motion
     renders a static face. */

import { useEffect, useRef } from 'react'

type OrbParams = {
  prx: number; pry: number     // pupil radii
  pdx: number; pdy: number     // pupil offset from home (svg units)
  spacing: number              // half-distance between pupils
  lid: number                  // 0 open .. 1 shut (both eyes)
  lidAsym: number              // extra shut on right eye (wink/skeptic)
  brow: number                 // lid slant degrees (angry), mirrored per eye
  tilt: number                 // whole-orb lean degrees
  squash: number               // whole-orb scale (1 = normal)
  bob: number; bobHz: number   // float amplitude (svg units) + speed
  sway: number; swayHz: number // pupil x wander amplitude + speed
  blinkMin: number; blinkMax: number
}

const B: OrbParams = {
  prx: 20, pry: 46, pdx: 0, pdy: 0, spacing: 38,
  lid: 0, lidAsym: 0, brow: 0, tilt: 0, squash: 1,
  bob: 5, bobHz: 0.9, sway: 0, swayHz: 3, blinkMin: 3400, blinkMax: 6200,
}
const P = (o: Partial<OrbParams>): OrbParams => ({ ...B, ...o })

/* All 23 moods. Keys match the orbSay() vocabulary 1:1. */
const MOODS: Record<string, OrbParams> = {
  idle: P({}),
  sleeping: P({ lid: 0.94, pry: 30, bob: 3, bobHz: 0.45, blinkMin: 6500, blinkMax: 9500 }),
  waking: P({ lid: 0, bob: 8, bobHz: 1.4 }),
  listening: P({ pdy: -12, pry: 50 }),
  thinking: P({ pdx: 14, pdy: -14, lidAsym: 0.3, pry: 42 }),
  searching: P({ prx: 24, sway: 10, swayHz: 4, blinkMin: 2800, blinkMax: 5000 }),
  working: P({ pdy: 12, lid: 0.15, squash: 0.97, pry: 42 }),
  excited: P({ prx: 30, pry: 56, bob: 9, bobHz: 2.2, blinkMin: 1800, blinkMax: 3600 }),
  bored: P({ lid: 0.45, prx: 16, pry: 30, bob: 3, bobHz: 0.5, blinkMin: 6500, blinkMax: 9500 }),
  suspicious: P({ pdx: 16, lid: 0.1, lidAsym: 0.35, tilt: -4 }),
  angry: P({ lid: 0.3, brow: 26, prx: 20, pry: 36, pdy: 6 }),
  drowsy: P({ lid: 0.65, pry: 34, bob: 3, bobHz: 0.5, blinkMin: 4800, blinkMax: 9500 }),
  happy: P({ prx: 26, pry: 58, bob: 7, bobHz: 1.8 }),
  curious: P({ tilt: -6, pry: 50 }),
  confused: P({ tilt: 7, lid: 0.15, pry: 44 }),
  surprised: P({ prx: 32, pry: 60, squash: 1.06, bob: 4, bobHz: 2 }),
  proud: P({ pdy: -16, lid: 0.2, squash: 1.03 }),
  shy: P({ pdy: 16, lid: 0.3, squash: 0.92 }),
  sad: P({ pdy: 14, lid: 0.5, prx: 18, pry: 34, bob: 2, bobHz: 0.5 }),
  laughing: P({ prx: 26, pry: 56, lid: 0.25, bob: 10, bobHz: 2.6, blinkMin: 1200, blinkMax: 3600 }),
  scared: P({ prx: 30, pry: 58, sway: 4, swayHz: 9, blinkMin: 1200, blinkMax: 3600 }),
  playful: P({ pdx: 12, lidAsym: 0.55, tilt: 6 }),
  celebrate: P({ prx: 28, pry: 58, bob: 11, bobHz: 2.4, sway: 6, swayHz: 4, blinkMin: 1800, blinkMax: 3600 }),
}

const BASE = 'idle'
const MOVE_GAP = 1500
const REVERT_MS = 3200
const REACT_DELAY = 450
const BORED_MS = 30000
const DROWSY_MS = 60000
const SLEEP_MS = 90000
const PUPIL_MAX = 10
const HX = 38          // pupil home |x|
const HY = -8          // pupil home y
const BODY_R = 118

type FocusDetail = { selector: string; mood: string; dwellMs: number }
type OrbitDetail = { selector: string; mood: string }

export function OrbCompanion() {
  const rootRef = useRef<HTMLDivElement>(null)
  const mountRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<SVGGElement>(null)
  const pupilLRef = useRef<SVGEllipseElement>(null)
  const pupilRRef = useRef<SVGEllipseElement>(null)
  const glintLRef = useRef<SVGCircleElement>(null)
  const glintRRef = useRef<SVGCircleElement>(null)
  const lidLRef = useRef<SVGRectElement>(null)
  const lidRRef = useRef<SVGRectElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const mount = mountRef.current
    if (!root || !mount) return
    let dead = false
    let lastMove = 0
    let hiddenAt = 0
    let focusUntil = 0
    let cur = { x: 0, y: 0 }
    let gaze = { x: 0, y: 0 }
    let gazeT = { x: 0, y: 0 }
    let lookTilt = 0
    let mouse: { x: number; y: number } | null = null
    let tgt: OrbParams = { ...MOODS[BASE] }
    let cur2: OrbParams = { ...MOODS[BASE] }
    let tSec = Math.random() * 10
    let lastT = performance.now()
    let nextBlink = lastT + 2500
    let blinkAt = -1
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

    /* Write a full param set straight to the DOM (no transition). */
    const applyAll = (p: OrbParams, lids: number, lidsR: number, tilt: number, bobY: number, gx: number, gy: number, swayX: number) => {
      const pl = pupilLRef.current, pr = pupilRRef.current
      const gl = glintLRef.current, gr = glintRRef.current
      const ll = lidLRef.current, lr = lidRRef.current
      const bd = bodyRef.current
      if (!pl || !pr || !gl || !gr || !ll || !lr || !bd) return
      const lcx = -p.spacing + p.pdx + gx + swayX
      const rcx = p.spacing + p.pdx + gx + swayX
      const cy = HY + p.pdy + gy
      pl.setAttribute('cx', lcx.toFixed(1)); pl.setAttribute('cy', cy.toFixed(1))
      pl.setAttribute('rx', p.prx.toFixed(1)); pl.setAttribute('ry', p.pry.toFixed(1))
      pr.setAttribute('cx', rcx.toFixed(1)); pr.setAttribute('cy', cy.toFixed(1))
      pr.setAttribute('rx', p.prx.toFixed(1)); pr.setAttribute('ry', p.pry.toFixed(1))
      /* Glints ride the pupil proportionally and vanish under closed lids. */
      const gs = p.pry / 46
      gl.setAttribute('cx', (lcx + 7 * gs).toFixed(1)); gl.setAttribute('cy', (cy - 12 * gs).toFixed(1))
      gl.setAttribute('r', (5 * gs).toFixed(1)); gl.setAttribute('opacity', lids > 0.55 ? '0' : '0.5')
      gr.setAttribute('cx', (rcx + 7 * gs).toFixed(1)); gr.setAttribute('cy', (cy - 12 * gs).toFixed(1))
      gr.setAttribute('r', (5 * gs).toFixed(1)); gr.setAttribute('opacity', lidsR > 0.55 ? '0' : '0.5')
      const lidH = (v: number) => Math.max(0, Math.min(1, v)) * 116
      ll.setAttribute('y', (HY - 58).toFixed(1)); ll.setAttribute('height', lidH(lids).toFixed(1))
      ll.setAttribute('transform', `rotate(${p.brow} ${-HX} ${HY})`)
      lr.setAttribute('y', (HY - 58).toFixed(1)); lr.setAttribute('height', lidH(lidsR).toFixed(1))
      lr.setAttribute('transform', `rotate(${-p.brow} ${HX} ${HY})`)
      bd.setAttribute('transform', `translate(0 ${bobY.toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(${p.squash.toFixed(3)})`)
    }
    const clearTimers = () => {
      for (const t of [revertT, moodT, boredT, drowsyT, sleepT, releaseT]) if (t) clearTimeout(t)
      for (const t of orbitTs) clearTimeout(t)
      revertT = moodT = boredT = drowsyT = sleepT = releaseT = undefined
      orbitTs = []
    }
    const scheduleRevert = (ms = REVERT_MS) => {
      if (revertT) clearTimeout(revertT)
      revertT = setTimeout(() => { if (!dead) tgt = { ...MOODS[BASE] } }, ms)
    }
    const pokeIdle = () => {
      if (boredT) clearTimeout(boredT)
      if (drowsyT) clearTimeout(drowsyT)
      if (sleepT) clearTimeout(sleepT)
      boredT = setTimeout(() => { if (!dead) tgt = { ...MOODS.bored } }, BORED_MS)
      drowsyT = setTimeout(() => { if (!dead) tgt = { ...MOODS.drowsy } }, DROWSY_MS)
      sleepT = setTimeout(() => { if (!dead) tgt = { ...MOODS.sleeping } }, SLEEP_MS)
    }
    const react = (mood: string) => {
      if (!MOODS[mood] || reduced) return
      tgt = { ...MOODS[mood] }
      scheduleRevert()
      pokeIdle()
    }
    const onMood = (e: Event) => react((e as CustomEvent<string>).detail)
    const onLock = () => react('shy')

    const orbCenter = () => {
      const r = root.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    /* Aim pupils at a screen point; lean the body a little that way. */
    const aimAt = (x: number, y: number) => {
      const c = orbCenter()
      const dx = x - c.x, dy = y - c.y
      const d = Math.hypot(dx, dy) || 1
      const m = Math.min(1, d / 240) * PUPIL_MAX
      gazeT = { x: (dx / d) * m, y: (dy / d) * m }
      lookTilt = Math.max(-10, Math.min(10, dx / 22))
    }

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

    const focusEl = (el: Element, mood: string, dwellMs: number) => {
      const phone = root.parentElement
      if (!phone) return
      const pr = phone.getBoundingClientRect()
      const er = el.getBoundingClientRect()
      const s = root.offsetWidth || 84
      const maxX = Math.max(0, pr.width - 24 - s)
      const maxUp = Math.max(120, pr.height - s - 190 - 100)
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
      let tx = er.right - pr.left + 14 - 12
      if (tx > maxX) tx = er.left - pr.left - s - 14 - 12
      tx = clamp(tx, -12, maxX)
      /* 184 mirrors the CSS base (nav 62 + safe-area + 122px lift). */
      const layoutCenterY = pr.bottom - 184 - s / 2
      const ty = clamp(er.top + er.height / 2 - layoutCenterY, -maxUp, 0)
      cur = { x: Math.round(tx), y: Math.round(ty) }
      root.style.transform = `translate3d(${cur.x}px,${cur.y}px,0)`
      lastMove = Date.now()
      aimAt(er.left + er.width / 2, er.top + er.height / 2)
      react(mood)
      focusUntil = Date.now() + dwellMs
      if (releaseT) clearTimeout(releaseT)
      releaseT = setTimeout(() => { if (!dead) { focusUntil = 0; tgt = { ...MOODS[BASE] }; pokeIdle() } }, dwellMs)
    }
    const onFocus = (e: Event) => {
      const d = (e as CustomEvent<FocusDetail>).detail
      if (!d?.selector || reduced) return
      const el = root.parentElement?.querySelector(d.selector) ?? document.querySelector(d.selector)
      if (el) focusEl(el, d.mood || 'happy', d.dwellMs || 4000)
      else react(d.mood || 'happy')
    }
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
          aimAt(cc.x, cc.y)
          lastMove = Date.now()
        }, i * 1000))
      })
      releaseT = setTimeout(() => { if (!dead) { focusUntil = 0; tgt = { ...MOODS[BASE] }; pokeIdle() } }, 3300)
      pokeIdle()
    }

    const onInteract = (e: Event) => {
      if (reduced || dead) return
      pokeIdle()
      const pe = e as PointerEvent
      const hasPoint = typeof pe.clientX === 'number'
      if (e.target instanceof Node && root.contains(e.target)) {
        tgt = { ...MOODS.surprised }
        gazeT = { x: 0, y: 0 }
        lookTilt = 0
        hop()
        roam()
        lastMove = Date.now()
        scheduleRevert(2600)
        setTimeout(() => { if (!dead) tgt = { ...MOODS.playful } }, 900)
        return
      }
      let mood = 'curious'
      if (e.target instanceof Element) {
        const tagged = e.target.closest('[data-orb]')
        const want = tagged?.getAttribute('data-orb')
        if (want && MOODS[want]) mood = want
      }
      if (hasPoint) aimAt(pe.clientX, pe.clientY)
      else tgt = { ...MOODS.curious }
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
        } else if (!reduced) {
          tgt = { ...(hiddenAt && Date.now() - hiddenAt > 8000 ? MOODS.waking : MOODS[BASE]) }
          scheduleRevert()
          pokeIdle()
        }
      } catch {}
    }

    /* The one loop: ease params toward target, bob/sway/blink, aim gaze,
       write a handful of SVG attributes. Gaze target tracks the cursor on
       desktop; touch aims decay back to cursor/center. */
    const onMouse = (e: MouseEvent) => { mouse = { x: e.clientX, y: e.clientY } }
    const frame = (now: number) => {
      if (dead) return
      const dt = Math.min(64, now - lastT)
      lastT = now
      if (!document.hidden) {
        tSec += dt / 1000
        const k = 0.16
        for (const key of Object.keys(tgt) as (keyof OrbParams)[]) {
          cur2[key] += (tgt[key] - cur2[key]) * k
        }
        if (finePointer && mouse) {
          const r = root.getBoundingClientRect()
          const dx = mouse.x - (r.left + r.width / 2)
          const dy = mouse.y - (r.top + r.height / 2)
          const d = Math.hypot(dx, dy) || 1
          const m = Math.min(1, d / 200) * PUPIL_MAX
          gazeT = { x: gazeT.x + ((dx / d) * m - gazeT.x) * 0.06, y: gazeT.y + ((dy / d) * m - gazeT.y) * 0.06 }
        } else {
          gazeT = { x: gazeT.x * 0.99, y: gazeT.y * 0.99 }
        }
        gaze = { x: gaze.x + (gazeT.x - gaze.x) * 0.2, y: gaze.y + (gazeT.y - gaze.y) * 0.2 }
        lookTilt *= 0.94
        /* Blink envelope from the active mood's tier. */
        let blink = 0
        if (blinkAt < 0 && now >= nextBlink) blinkAt = now
        if (blinkAt >= 0) {
          const e = (now - blinkAt) / 140
          if (e >= 1) {
            blinkAt = -1
            nextBlink = now + cur2.blinkMin + Math.random() * (cur2.blinkMax - cur2.blinkMin)
          } else blink = Math.sin(e * Math.PI)
        }
        const lids = Math.min(1, cur2.lid + blink)
        const lidsR = Math.min(1, cur2.lid + cur2.lidAsym + blink)
        const swayX = Math.sin(tSec * cur2.swayHz * Math.PI * 2) * cur2.sway
        const bobY = Math.sin(tSec * cur2.bobHz * Math.PI * 2) * cur2.bob
        applyAll(cur2, lids, lidsR, cur2.tilt + lookTilt, bobY, gaze.x, gaze.y, swayX)
      }
      raf = requestAnimationFrame(frame)
    }

    if (reduced) {
      /* Static face, instant mood snaps, no travel. */
      applyAll(cur2, 0, 0, 0, 0, 0, 0, 0)
      const snap = (e: Event) => {
        const m = (e as CustomEvent<string>).detail
        if (MOODS[m]) { cur2 = { ...MOODS[m] }; applyAll(cur2, cur2.lid, cur2.lid + cur2.lidAsym, cur2.tilt, 0, 0, 0, 0) }
      }
      window.addEventListener('fc:orb-mood', snap)
      return () => window.removeEventListener('fc:orb-mood', snap)
    }
    pokeIdle()
    raf = requestAnimationFrame(frame)

    window.addEventListener('fc:orb-mood', onMood)
    window.addEventListener('fc:orb-focus', onFocus)
    window.addEventListener('fc:orb-orbit', onOrbit)
    window.addEventListener('fc:lock', onLock)
    document.addEventListener('pointerdown', onInteract, { capture: true, passive: true })
    document.addEventListener('scroll', onInteract, { capture: true, passive: true })
    document.addEventListener('visibilitychange', onVis)
    if (finePointer) window.addEventListener('mousemove', onMouse, { passive: true })

    return () => {
      dead = true
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
    }
  }, [])

  /* SSR + first paint: full base face, byte-identical client-side. */
  return (
    <div ref={rootRef} className="orb-companion" aria-hidden="true">
      <div ref={mountRef} className="orb-stage">
        <svg className="orb-svg" viewBox="-150 -150 300 300" aria-hidden="true">
          <defs>
            <radialGradient id="syllabiBody" cx="38%" cy="30%" r="85%">
              <stop offset="0%" stopColor="#ef6a1a" />
              <stop offset="60%" stopColor="#e8480c" />
              <stop offset="100%" stopColor="#d9480a" />
            </radialGradient>
            <clipPath id="syllabiClip">
              <circle cx="0" cy="0" r={BODY_R} />
            </clipPath>
          </defs>
          <g ref={bodyRef}>
            <circle cx="0" cy="0" r={BODY_R} fill="url(#syllabiBody)" />
            <ellipse cx="-44" cy="-62" rx="26" ry="13" fill="#ffffff" opacity="0.1" transform="rotate(-20 -44 -62)" />
            <ellipse ref={pupilLRef} cx={-HX} cy={HY} rx="20" ry="46" fill="#2b1708" />
            <ellipse ref={pupilRRef} cx={HX} cy={HY} rx="20" ry="46" fill="#2b1708" />
            <circle ref={glintLRef} cx={-HX + 7} cy={HY - 12} r="5" fill="#ffffff" opacity="0.5" />
            <circle ref={glintRRef} cx={HX + 7} cy={HY - 12} r="5" fill="#ffffff" opacity="0.5" />
            <g clipPath="url(#syllabiClip)">
              <rect ref={lidLRef} x={-HX - 32} y={HY - 58} width="64" height="0" rx="18" fill="url(#syllabiBody)" />
              <rect ref={lidRRef} x={HX - 32} y={HY - 58} width="64" height="0" rx="18" fill="url(#syllabiBody)" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  )
}
