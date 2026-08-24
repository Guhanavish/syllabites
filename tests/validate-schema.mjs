/* Static validator for supabase/schema.sql */
import fs from 'fs'

const sql = fs.readFileSync('G:/Foodcourt/web/supabase/schema.sql', 'utf8')
let pass = 0, fail = 0
const ok = (cond, msg) => { if (cond) { pass++; console.log('  \u2713 ' + msg) } else { fail++; console.log('  \u2717 ' + msg) } }

console.log('— structure —')
const dollars = (sql.match(/\$\$/g) || []).length
ok(dollars % 2 === 0, `dollar-quotes balanced (${dollars})`)

/* every security definer function must include the extensions schema in
   its search_path, or pgcrypto's crypt()/gen_salt() are invisible */
{
  const defs = [...sql.matchAll(/create or replace function[^$]*?security definer\s+set search_path = ([^$]*?)as \$/gi)]
  const missing = defs.filter((d) => !/extensions/.test(d[1]))
  ok(missing.length === 0, `all ${defs.length} security-definer functions include extensions schema in search_path`
    + (missing.length ? ' — MISSING: lines ' + missing.map((d) => sql.slice(0, d.index).split('\n').length).join(', ') : ''))
}

/* parenthesis depth walk (quote/comment/dollar aware) — catches unbalanced parens */
{
  let depth = 0, inQ = false, inDollar = false, inLine = false, minDepth = 0
  const negatives = []
  let line = 1
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i], next = sql[i + 1]
    if (ch === '\n') { line++; inLine = false; continue }
    if (inLine) continue
    if (ch === '-' && next === '-') { inLine = true; continue }
    if (inDollar) { if (sql.slice(i, i + 2) === '$$') { inDollar = false; i++ } continue }
    if (inQ) { if (ch === "'") { if (next === "'") i++; else inQ = false } continue }
    if (ch === "'") { inQ = true; continue }
    if (sql.slice(i, i + 2) === '$$') { inDollar = true; i++; continue }
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth < 0 && negatives.length < 3) negatives.push(line) }
  }
  ok(depth === 0 && negatives.length === 0,
    `parentheses balanced end-to-end (final depth ${depth}${negatives.length ? `, went NEGATIVE at line(s) ${negatives}` : ''})`)
}
const begins = (sql.match(/\bbegin\b/gi) || []).length
const ends = (sql.match(/\bend\b(?!\s*if\b)/gi) || []).length
console.log(`  ℹ begin: ${begins}, end/end-if blocks: ${ends} (informational)`)

/* split into statements respecting single quotes, tracking line numbers */
console.log('— RAISE statements —')
let stmts = [], cur = '', inQ = false, startLine = 1, line = 1
for (const ch of sql) {
  if (ch === '\n') line++
  if (ch === "'") inQ = !inQ
  if (ch === ';' && !inQ) { if (cur.trim()) stmts.push({ text: cur, line: startLine }); cur = ''; startLine = line + 1 } else { if (!cur.trim() && !/\s/.test(ch)) startLine = line; cur += ch }
}
let raises = 0
for (const st of stmts) {
  const m = st.text.match(/raise\s+(?:exception|notice)\s+'((?:[^']|'')*)'/i)
  if (!m) continue
  raises++
  const specifiers = (m[1].match(/(?<!%)%(?!%)/g) || []).length
  let after = st.text.slice(m.index + m[0].length)
  let depth = 0, argCount = 0, sawArg = false
  for (const ch of after) {
    if ('(['.includes(ch)) depth++
    else if (')]'.includes(ch)) depth--
    else if (ch === ',' && depth === 0) { if (sawArg) argCount++; sawArg = false }
    else if (!/\s/.test(ch)) sawArg = true
  }
  if (sawArg) argCount++
  ok(specifiers === argCount, `L${st.line}: RAISE '${m[1].slice(0, 42)}…' ${specifiers} placeholder(s) / ${argCount} arg(s)`)
}
ok(raises >= 20, `checked ${raises} RAISE statements`)

/* RPC definitions vs API route calls */
console.log('— RPC signatures vs API routes —')
const fnDefs = {}
for (const m of sql.matchAll(/create or replace function\s+(\w+)\s*\(([^)]*)\)/gi)) {
  fnDefs[m[1].toLowerCase()] = new Set(
    m[2] === '' ? [] : m[2].split(',').map((p) => p.trim().split(/\s+/)[0])
  )
}
let routeCalls = 0
const routesDir = 'G:/Foodcourt/web/src/app/api'
function* routeFiles(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = dir + '/' + e.name
    if (e.isDirectory()) yield* routeFiles(p)
    else if (e.name === 'route.ts') yield p
  }
}
for (const file of routeFiles(routesDir)) {
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/sb\(\)\.rpc\(\s*['"](\w+)['"]\s*,\s*\{([^}]*)\}/g)) {
    routeCalls++
    const name = m[1].toLowerCase()
    const args = (m[2].match(/\bp_\w+/g) || [])
    if (!fnDefs[name]) { bad(false, `${file}: rpc ${name} NOT DEFINED in schema`); continue }
    const defParams = [...fnDefs[name]]
    const missing = args.filter((a) => !fnDefs[name].has(a))
    const unused = defParams.filter((a) => !args.includes(a))
    ok(missing.length === 0, `${file.split('api/')[1]}: rpc ${name}(${args.join(', ')}) ✓ schema${unused.length ? ` [unused in call: ${unused}]` : ''}`)
  }
}
ok(routeCalls >= 14, `checked ${routeCalls} rpc calls across routes`)

/* forward references inside LANGUAGE sql functions */
console.log('— forward references (LANGUAGE sql) —')
const fns = []
for (const m of sql.matchAll(/create or replace function\s+(\w+)\s*\(([^$]*?)language\s+(sql|plpgsql)[^$]*?\$\$([\s\S]*?)\$\$/gi)) {
  fns.push({ name: m[1].toLowerCase(), line: sql.slice(0, m.index).split('\n').length, body: m[4] })
}
let fwdChecked = 0
for (const f of fns.filter((x) => x.lang === 'sql')) {
  for (const other of fns) {
    if (other.name === f.name) continue
    if (new RegExp('\\b' + other.name + '\\s*\\(', 'i').test(f.body)) {
      fwdChecked++
      ok(other.line < f.line, `sql fn ${f.name}(L${f.line}) → ${other.name} defined at L${other.line}`)
    }
  }
}

/* PER-FUNCTION BODY parenthesis balance — each $$ body must net zero */
console.log('— function body parentheses —')
let bodyChecked = 0
for (const f of fns) {
  let depth = 0, inQ = false, min = 0
  for (let i = 0; i < f.body.length; i++) {
    const ch = f.body[i], next = f.body[i + 1]
    if (ch === "'") { if (inQ && next === "'") i++; else inQ = !inQ; continue }
    if (inQ) continue
    if (ch === '(') depth++
    else if (ch === ')') { depth--; if (depth < min) min = depth }
  }
  bodyChecked++
  ok(depth === 0 && min >= 0, `${f.name}(): parens ${depth === 0 ? 'balanced' : `IMBALANCE (net ${depth})`}${min < 0 ? ', closes early!' : ''}`)
}
ok(bodyChecked > 0, `checked ${bodyChecked} function bodies`)

/* order_full keys vs frontend expectations */
console.log('— returned jsonb shape —')
const ofn = fns.find((f) => f.name === 'order_full')
const needKeys = ['id', 'tokenNo', 'section', 'status', 'total', 'clientToken', 'createdAt', 'items']
const missingKeys = needKeys.filter((k) => !ofn || !ofn.body.toLowerCase().includes(k.toLowerCase()))
ok(missingKeys.length === 0, 'order_full exposes every key the UI needs' + (missingKeys.length ? ' MISSING: ' + missingKeys : ''))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
