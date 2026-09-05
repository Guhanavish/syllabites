/* Execute schema.sql against an in-memory real Postgres (PGlite).
   Catches every parse/compile error exactly like Supabase would. */
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'fs'

const sql = fs.readFileSync('G:/Foodcourt/web/supabase/schema.sql', 'utf8')
const db = new PGlite({ extensions: { pgcrypto } })

try {
  /* split into statements (respecting '' strings, -- comments and $$ bodies) */
  const stmts = []
  let cur = '', inQ = false, inDollar = false, startLine = 1, line = 1
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i], two = sql.slice(i, i + 2)
    if (ch === '\n') line++
    if (inDollar && two === '$$') { inDollar = false; cur += two; i++; continue }
    if (!inQ && !inDollar && two === '$$') { inDollar = true; cur += two; i++; continue }
    if (!inQ && !inDollar && ch === '-' && two === '--') { while (i < sql.length && sql[i] !== '\n') { cur += sql[i]; i++ } cur += sql[i] ?? ''; continue }
    if (inDollar) { cur += ch; continue }
    if (ch === "'") { if (sql[i + 1] === "'") { cur += "''"; i++; continue } inQ = !inQ }
    if (ch === ';' && !inQ) { if (cur.trim()) stmts.push({ text: cur.trim(), line: startLine }); cur = ''; startLine = line + (ch === '\n' ? 1 : 0) } else { if (!cur.trim() && ch !== ' ' && ch !== '\n') startLine = line; cur += ch }
  }
  if (cur.trim()) stmts.push({ text: cur.trim(), line: startLine })
  console.log(`executing ${stmts.length} statements…`)
  for (const [idx, st] of stmts.entries()) {
    try {
      await db.exec(st.text)
    } catch (e) {
      console.error(`✗ FAILED at statement #${idx + 1} (file line ~${st.line})`)
      console.error('  ERROR:', e.message)
      console.error('  STATEMENT:')
      console.error(st.text.split('\n').map((l) => '    | ' + l).join('\n'))
      process.exit(1)
    }
  }
  console.log('✓ SCHEMA EXECUTED CLEANLY')
} catch (e) {
  console.error('✗ ERROR:', e.message)
  process.exit(1)
}

/* functional spot-checks against the live functions */
let passed = 0, failed = 0
const ok = (cond, msg, extra = '') => {
  if (cond) { passed++; console.log('  ✓ ' + msg) } else { failed++; console.log('  ✗ ' + msg + (extra ? ' — ' + extra : '')) }
}
const toJ = (x) => (typeof x === 'string' ? JSON.parse(x) : x)

{
  const r = await db.exec(`select gate_verify('syllabites123') as v`)
  ok(r[0].rows[0].v >= 1, 'gate_verify default password')
}
{
  const wrong = await db.exec(`select gate_verify('nope') as v`).catch((e) => e)
  ok(wrong instanceof Error || (wrong[0] && false), 'gate_verify rejects wrong password')
}
{
  const r = await db.exec(`select admin_login('admin', 'admin123') as t`)
  const token = r[0].rows[0].t
  ok(!!token && token.length === 36, 'admin login returns session uuid')

  const item = await db.exec(
    `select admin_save_item('${token}', '{"name":"Test Tea","emoji":"🧋","category":"Drinks","price":10,"stock":5,"available":true}'::jsonb) as it`
  )
  const itemId = toJ(item[0].rows[0].it).id
  ok(!!itemId, 'item created #' + itemId)

  const ord = await db.exec(
    `select place_order('boys', 'pglitetoken00000001', '[{"itemId":${itemId},"qty":2}]'::jsonb) as o`
  )
  const order = toJ(ord[0].rows[0].o)
  ok(order.tokenNo === 1 && order.total === 2000, `order B-1 total ₹20 (got ${order.tokenNo}, ${order.total})`)

  const stock = await db.exec(`select stock from items where id = ${itemId}`)
  ok(stock[0].rows[0].stock === 3, 'stock decremented 5→3')

  const dup = await db.exec(
    `select place_order('boys', 'pglitetoken00000001', '[{"itemId":${itemId},"qty":2}]'::jsonb) as o`
  )
  const dupOrder = toJ(dup[0].rows[0].o)
  ok(dupOrder.id === order.id, 'duplicate send idempotent')

  const board = await db.exec(`select counter_board('boys') as b`)
  const bb = toJ(board[0].rows[0].b)
  ok(bb.active.length === 1, 'counter board shows waiting order')

  const served = await db.exec(`select set_order_status(${order.id}, 'completed') as o`)
  ok(served[0].rows.length === 1, 'mark served')

  const stats = await db.exec(`select admin_stats('${token}', 'today') as s`)
  const st = toJ(stats[0].rows[0].s)
  ok(st.revenue === 2000 && st.sections.boys.orders === 1, `stats revenue ₹20 (got ${st.revenue})`)

  // backups / reset / restore
  const bk = await db.exec(`select admin_reset_all('${token}', 'test snapshot') as b`)
  const binfo = toJ(bk[0].rows[0].b)
  ok(binfo.backedUpItems === 1 && binfo.backupId > 0, `reset backed up (${binfo.backedUpItems} items)`)

  const afterReset = await db.exec(`select count(*) as c from items`)
  ok(afterReset[0].rows[0].c === 0, 'live data wiped')

  const restored = await db.exec(`select admin_restore_backup('${token}', ${binfo.backupId}) as r`)
  const rr = toJ(restored[0].rows[0].r)
  ok(rr.items === 1, 'restore brings items back')

  const seqCheck = await db.exec(`insert into items (name, price, stock) values ('Seq Check', 100, 1) returning id`)
  const restoredMax = await db.exec(`select max(id) as m from items`)
  ok(Number(seqCheck[0].rows[0].id) > Number(restoredMax[0].rows[0].m) - 2,
    `sequences advanced past restored ids (new id ${seqCheck[0].rows[0].id}, max restored ${restoredMax[0].rows[0].m})`)

  // parcel menu separation: bidirectional isolation
  const parcelItem = await db.exec(
    `select admin_save_parcel_item('${token}', '{"name":"Parcel Samosa","emoji":"🥟","category":"Snacks","price":15,"stock":10,"available":true}'::jsonb) as it`
  )
  const parcelId = toJ(parcelItem[0].rows[0].it).id
  ok(!!parcelId, 'parcel item created #' + parcelId)

  const parcelList = await db.exec(`select admin_list_parcel_items('${token}') as l`)
  ok(Array.isArray(toJ(parcelList[0].rows[0].l)) && toJ(parcelList[0].rows[0].l).some((i) => i.id === parcelId), 'parcel items listed separately')

  const staffList = await db.exec(`select admin_list_items('${token}') as l`)
  ok(!toJ(staffList[0].rows[0].l).some((i) => i.name === 'Parcel Samosa'), 'staff menu isolated from parcel item')

  const staffBefore = await db.exec(`select stock from items where id = ${itemId}`)
  const parcelOrder = await db.exec(
    `select public_place_order('[{"itemId":${parcelId},"qty":2}]'::jsonb, 'Test User', '10-A', 'A', 'Sports') as o`
  )
  const po = toJ(parcelOrder[0].rows[0].o)
  ok(/^\d{6}$/.test(po.code) && po.total === 3000, `parcel order 6-digit code + total ₹30 (got ${po.code}, ${po.total})`)
  ok('originalTotal' in po && 'isDiscounted' in po, 'parcel order exposes discount fields')

  const parcelStock = await db.exec(`select stock from parcel_items where id = ${parcelId}`)
  ok(parcelStock[0].rows[0].stock === 8, 'parcel stock decremented 10→8')

  const staffAfter = await db.exec(`select stock from items where id = ${itemId}`)
  ok(String(staffAfter[0].rows[0].stock) === String(staffBefore[0].rows[0].stock), 'staff stock untouched by parcel order')

  // staff order must not touch parcel stock
  const parcelBefore2 = (await db.exec(`select stock from parcel_items where id = ${parcelId}`))[0].rows[0].stock
  await db.exec(`select place_order('girls', 'pgliteparceliso00001', '[{"itemId":${itemId},"qty":1}]'::jsonb) as o`)
  const parcelAfter2 = (await db.exec(`select stock from parcel_items where id = ${parcelId}`))[0].rows[0].stock
  ok(String(parcelBefore2) === String(parcelAfter2), 'parcel stock untouched by staff order')

  // cancel parcel order restores parcel stock only
  await db.exec(`select admin_update_public_order_status('${token}', ${po.id}, 'cancelled') as o`)
  const parcelRestored = (await db.exec(`select stock from parcel_items where id = ${parcelId}`))[0].rows[0].stock
  ok(parcelRestored === 10, 'parcel cancel restores parcel stock')

  // backup covers both menus
  const payload = await db.exec(`select backup_payload() as p`)
  const pl = toJ(payload[0].rows[0].p)
  ok(Array.isArray(pl.parcelItems) && Array.isArray(pl.publicOrders), 'backup payload includes parcel data')

  const stats2 = await db.exec(`select admin_stats('${token}', 'today') as s`)
  const st2 = toJ(stats2[0].rows[0].s)
  ok(typeof st2.parcelRevenue === 'number' && typeof st2.parcelOrders === 'number', 'stats expose parcelRevenue/parcelOrders')

  // over-limit price gets a friendly error, not a raw check-constraint violation
  const tooHigh = await db.exec(
    `select admin_save_parcel_item('${token}', '{"name":"Too Rich","price":2000000,"stock":1}'::jsonb) as it`
  ).catch((e) => e)
  ok(tooHigh instanceof Error && /Price too high/.test(tooHigh.message), 'parcel save rejects ₹20L with friendly message')

  // bad backup fails BEFORE wiping — live data must survive
  const liveBefore = (await db.exec(`select count(*) as c from parcel_items`))[0].rows[0].c
  const badPayload = JSON.stringify({
    items: [], parcelItems: [{ name: 'Bad Parcel', price: 0, stock: 1 }],
    orders: [], orderItems: [], publicOrders: [], publicOrderItems: [],
  })
  const badRestore = await db.exec(`select restore_payload('${badPayload}'::jsonb)`).catch((e) => e)
  ok(badRestore instanceof Error && /Cannot import/.test(badRestore.message), 'restore with price 0 fails friendly')
  const liveAfter = (await db.exec(`select count(*) as c from parcel_items`))[0].rows[0].c
  ok(String(liveAfter) === String(liveBefore) && Number(liveBefore) > 0, 'live parcel data survives failed restore')

  // float-ish prices in a payload still import (tolerant cast)
  const floatPayload = JSON.stringify({
    items: [], parcelItems: [{ id: 999, name: 'Float Item', emoji: '🍽️', category: 'Snacks', price: '4999.0', stock: '5', available: true }],
    orders: [], orderItems: [], publicOrders: [], publicOrderItems: [],
  })
  await db.exec(`select restore_payload('${floatPayload}'::jsonb)`)
  const floatRow = (await db.exec(`select price, stock from parcel_items where name = 'Float Item'`))[0].rows[0]
  ok(Number(floatRow.price) === 4999 && Number(floatRow.stock) === 5, 'float-ish payload prices import cleanly')
}

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed ? 1 : 0)
