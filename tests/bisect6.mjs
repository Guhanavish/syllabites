import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create extension if not exists pgcrypto;`)

async function attempt(name, bodyLines, extra = '') {
  const st = `create or replace function t_${name}(p_token text, p_label text default null) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
${extra || '  z text;'}
begin
${bodyLines.map((l) => '  ' + l).join('\n')}
end $$;`
  try {
    await db.exec(st)
    console.log('PASS', name)
  } catch (e) {
    console.log('FAIL', name, '→', e.message)
  }
}

await attempt('m1_assign_coalesce_nullif_btrim', [`z := coalesce(nullif(btrim(p_label, '')), 'M');`])
await attempt('m2_assign_nullif_btrim',          [`z := nullif(btrim(p_label, ''), 'M');`])
await attempt('m3_assign_btrim_only',            [`z := btrim(p_label, '');`])
await attempt('m4_perform_coalesce_nullif',      [`perform coalesce(nullif(btrim(p_label, '')), 'M');`])
await attempt('m5_assign_nullif_lower',          [`z := nullif(lower(p_label), '');`])
await attempt('m6_assign_nullif_abs',            [`declare dummy int; begin dummy := nullif(abs(-1), 0)::int; end;`], '  dummy int;')
