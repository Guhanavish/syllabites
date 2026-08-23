/* Supabase smoke test — run AFTER applying schema.sql.
   Usage:  node tests/smoke.mjs
   Verifies: admin auth, item CRUD, ordering, stock, sales stats. */

const BASE = process.env.BASE || 'http://localhost:4000'
let passed = 0, failed = 0
const fails = []
function ok(name, cond, extra = '') {
  if (cond) { passed++; console.log('  \u2713 ' + name) }
  else { failed++; fails.push(name + (extra ? ' — ' + extra : '')); console.log('  \u2717 ' + name + (extra ? ' — ' + extra : '')) }
}
let COOKIE = ''
async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (COOKIE) headers['Cookie'] = COOKIE
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const sc = res.headers.get('set-cookie')
  if (sc) COOKIE = sc.split(';')[0]
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log('— admin auth —')
  const bad = await api('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'nope' } })
  ok('wrong password rejected', bad.status === 401)

  const login = await api('/api/admin/login', { method: 'POST', body: { username: 'admin', password: 'admin123' } })
  ok('admin login works', login.status === 200, JSON.stringify(login.data))
  if (login.status !== 200) throw new Error('Cannot continue without login')

  const check = await api('/api/admin/check')
  ok('session check', check.status === 200)

  console.log('— items —')
  const mk = await api('/api/items/save', {
    method: 'POST',
    body: { name: 'Smoke Test Tea', emoji: '🧋', category: 'Drinks', price: 10, stock: 5, available: true },
  })
  ok('create item ₹10 ×5', mk.status === 201 && mk.data?.id, JSON.stringify(mk.data))
  const itemId = mk.data?.id

  const list = await api('/api/items')
  ok('items listed', list.status === 200 && Array.isArray(list.data) && list.data.some((i) => i.id === itemId))

  console.log('— ordering —')
  const ct = 'smoketest000000000001'
  const o1 = await api('/api/orders/place', {
    method: 'POST',
    body: { section: 'boys', clientToken: ct, items: [{ itemId, qty: 2 }] },
  })
  ok('order placed (B-…)', o1.status === 201 && o1.data?.tokenNo >= 1 && o1.data?.total === 2000,
    JSON.stringify(o1.data))

  const dup = await api('/api/orders/place', {
    method: 'POST',
    body: { section: 'boys', clientToken: ct, items: [{ itemId, qty: 2 }] },
  })
  ok('duplicate send returns same order', dup.status === 201 && dup.data?.id === o1.data.id)

  const over = await api('/api/orders/place', {
    method: 'POST',
    body: { section: 'girls', clientToken: 'smoketest000000000002', items: [{ itemId, qty: 99 }] },
  })
  ok('over-stock rejected', over.status === 400)

  const mine = await api('/api/orders/mine', { method: 'POST', body: { tokens: [ct] } })
  ok('sender sees own order', Array.isArray(mine.data) && mine.data.length === 1)

  console.log('— counter board —')
  const board = await api('/api/board?section=boys')
  ok('boys board shows waiting order', board.data?.active?.some((o) => o.id === o1.data.id))
  const gboard = await api('/api/board?section=girls')
  ok('girls board isolated', !gboard.data?.active?.some((o) => o.id === o1.data.id))

  console.log('— serve + stats —')
  const served = await api('/api/orders/status', { method: 'POST', body: { id: o1.data.id, status: 'completed' } })
  ok('mark served', served.status === 200 && served.data?.status === 'completed')

  const stats = await api('/api/stats?range=today')
  ok('sales counted (₹20)', stats.data?.revenue >= 2000, JSON.stringify(stats.data?.revenue))
  ok('boys/girls split present', !!stats.data?.sections?.boys)

  console.log('— cleanup —')
  if (itemId) {
    const del = await api('/api/items/delete', { method: 'POST', body: { id: itemId } })
    ok('delete test item', del.status === 200)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (fails.length) { fails.forEach((f) => console.log('  • ' + f)) }
  process.exit(failed ? 1 : 0)
}

main().catch((e) => { console.error('SMOKE CRASH:', e.message); process.exit(2) })
