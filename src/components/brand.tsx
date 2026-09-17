'use client'

export function BrandHero({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="hero brand-hero">
      <div className="brand-eyebrow">CAMPUS FOOD COURT</div>
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
        <a href="https://github.com/Guhanavish" target="_blank" rel="noopener noreferrer" aria-label="Guhanavish on GitHub (opens in a new tab)">GitHub</a>
        <a href="https://www.linkedin.com/in/guhanavish-ss-12a328256" target="_blank" rel="noopener noreferrer" aria-label="Guhanavish on LinkedIn (opens in a new tab)">LinkedIn</a>
        <a href="https://www.instagram.com/guha._.1416/?__pwa=1" target="_blank" rel="noopener noreferrer" aria-label="Guhanavish on Instagram (opens in a new tab)">Instagram</a>
      </nav>
    </div>
  )
}
