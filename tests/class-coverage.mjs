/* Gate: every CSS class referenced in TSX must exist in globals.css. */
import fs from 'fs'
import path from 'path'

const SRC = 'G:/Foodcourt/web/src'
const CSS = fs.readFileSync('G:/Foodcourt/web/src/app/globals.css', 'utf8')
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) files.push(p)
  }
}
walk(SRC)

const STATE = new Set(['on', 'show', 'open', 'off', 'sel', 'enter', 'out', 'loading', 'hide', 'blink', 'pulse', 'hot', 'wide', 'block', 'sm', 'xl', 'ghost', 'enter'])
const used = new Map() // cls -> Set(files)
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const re = /className=(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`)/g
  let m
  while ((m = re.exec(src))) {
    let raw = m[1] ?? m[2] ?? m[3]
    raw = raw.replace(/\$\{[^}]*\}/g, ' ')
    for (const t of raw.split(/\s+/)) {
      const cls = t.trim()
      if (!cls || /[^A-Za-z0-9_-]/.test(cls) || STATE.has(cls)) continue
      if (!used.has(cls)) used.set(cls, new Set())
      used.get(cls).add(path.relative(SRC, f))
    }
  }
}
const missing = []
for (const [cls, fs_] of [...used.entries()].sort()) {
  const re = new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_-])`)
  if (!re.test(CSS)) missing.push([cls, [...fs_].join(',')])
}
console.log(`used classes: ${used.size}, missing from CSS: ${missing.length}`)
for (const [cls, f] of missing) console.log(`  ✗ .${cls}  (${f})`)
process.exit(missing.length ? 1 : 0)
