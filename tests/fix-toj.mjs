import fs from 'fs'
const f = 'G:/Foodcourt/web/tests/exec-schema.mjs'
let s = fs.readFileSync(f, 'utf8')
const pairs = [
  [`typeof dup[0].rows[0].o === 'string' ? JSON.parse(dup[0].rows[0].o) : dup[0].rows[0].o`, 'toJ(dup[0].rows[0].o)'],
  [`typeof board[0].rows[0].b === 'string' ? JSON.parse(board[0].rows[0].b) : board[0].rows[0].b`, 'toJ(board[0].rows[0].b)'],
  [`typeof served[0].rows[0].o === 'string' ? JSON.parse(served[0].rows[0].o) : served[0].rows[0].o`, 'toJ(served[0].rows[0].o)'],
  [`typeof stats[0].rows[0].s === 'string' ? JSON.parse(stats[0].rows[0].s) : stats[0].rows[0].s`, 'toJ(stats[0].rows[0].s)'],
  [`typeof bk[0].rows[0].b === 'string' ? JSON.parse(bk[0].rows[0].b) : bk[0].rows[0].b`, 'toJ(bk[0].rows[0].b)'],
  [`typeof restored[0].rows[0].r === 'string' ? JSON.parse(restored[0].rows[0].r) : restored[0].rows[0].r`, 'toJ(restored[0].rows[0].r)'],
]
for (const [a, b] of pairs) if (s.includes(a)) s = s.split(a).join(b)
fs.writeFileSync(f, s, 'utf8')
console.log('remaining raw JSON.parse:', (s.match(/JSON\.parse\(/g) || []).length)
