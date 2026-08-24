import fs from 'fs'
const f = 'G:/Foodcourt/web/supabase/schema.sql'
let s = fs.readFileSync(f, 'utf8')
const before = `v_label := coalesce(nullif(btrim(p_label, '')), 'Manual backup');`
const after = [
  "v_label := nullif(btrim(p_label, ''), '');",
  'if v_label is null then',
  "    v_label := 'Manual backup';",
  '  end if;',
].join('\n')
if (!s.includes(before)) { console.log('PATTERN NOT FOUND'); process.exit(1) }
s = s.split(before).join(after)
fs.writeFileSync(f, s, 'utf8')
console.log('create_backup label logic rewritten ✓')
