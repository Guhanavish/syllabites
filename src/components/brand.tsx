'use client'

import { IconGithub, IconLinkedin, IconInstagram } from '@/components/icons'

export function BrandHero({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="hero brand-hero">
      <span className="float" style={{ top: 14, right: 18 }} aria-hidden="true">🥟</span>
      <span className="float" style={{ bottom: 30, right: 66, animationDelay: '1.2s' }} aria-hidden="true">🥤</span>
      <span className="float" style={{ top: 40, right: 118, animationDelay: '2.1s' }} aria-hidden="true">🍚</span>
      <div className="brand-eyebrow">SYLLABITES · CAMPUS FOOD COURT</div>
      <h1 className="brand-title">{title}</h1>
      <p className="brand-sub">{sub}</p>
    </header>
  )
}

export function Credits() {
  return (
    <div className="credits">
      <p className="credits-line">Built by Guhanavish, Class XI. Inspired by Harish C, Class XII.</p>
      <nav className="credits-socials" aria-label="Creator social links">
        <a href="https://github.com/Guhanavish" target="_blank" rel="noopener noreferrer" aria-label="Guhanavish on GitHub (opens in a new tab)">
          <IconGithub size={18} />
        </a>
        <a href="https://www.linkedin.com/in/guhanavish-ss-12a328256" target="_blank" rel="noopener noreferrer" aria-label="Guhanavish on LinkedIn (opens in a new tab)">
          <IconLinkedin size={18} />
        </a>
        <a href="https://www.instagram.com/guha._.1416/?__pwa=1" target="_blank" rel="noopener noreferrer" aria-label="Guhanavish on Instagram (opens in a new tab)">
          <IconInstagram size={18} />
        </a>
      </nav>
    </div>
  )
}
