import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create extension if not exists pgcrypto;`)

async function attempt(name, body) {
  const st = `create or replace function t_${name}(p_token text, p_label text default null) returns void
language plpgsql as $$
begin
${body}
end $$;`
  try {
    await db.exec(st)
    console.log('PASS', name)
  } catch (e) {
    console.log('FAIL', name, '→', e.message, 'pos', e.position ?? '-')
  }
}

await attempt('A_perform_btrim_var_empty',   `perform nullif(btrim(p_label, ''), 'M');`)
await attempt('B_perform_btrim_var_space',   `perform nullif(btrim(p_label, ' '), 'M');`)
await attempt('C_select_into_btrim_var',     `declare z text; begin select nullif(btrim(p_label,''),'M') into z; end;`)
await attempt('D_assign_btrim_var',          `declare z text; begin z := nullif(btrim(p_label, ''), 'M'); end;`)
await attempt('E_insert_row_btrim_var',      `insert into backups (label, payload) values (coalesce(nullif(btrim(p_label, ''), 'M'), '{}'::jsonb))`)
await attempt('F_insert_values_multiline',   `insert into backups (label, payload)\n  values (\n    coalesce(nullif(btrim(p_label, ''), 'M'), '{}'::jsonb)\n  )`)
