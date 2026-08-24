import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create extension if not exists pgcrypto;`)
await db.exec(`create table backups (id bigint primary key generated always as identity, label text, payload jsonb, created_at timestamptz default now())`)
await db.exec(`create or replace function admin_verify(p_token text) returns void language plpgsql as $$ begin end $$`)
await db.exec(`create or replace function backup_payload() returns jsonb language sql as $$ select '{}'::jsonb $$`)

const MB = `'Manual backup'`
const expr = `values (coalesce(nullif(btrim(p_label, '')), ${MB}), backup_payload())`
const stmt = `create or replace function t_m(p_token text, p_label text default null) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint;
begin
  perform admin_verify(p_token);
  insert into backups (label, payload)
  ${expr}
  returning id into v_id;
  return v_id;
end $$;`

console.log('stmt length:', stmt.length)
console.log('char at position 325:', JSON.stringify(stmt[324]))
console.log('context:', JSON.stringify(stmt.slice(310, 340)))

// more isolation variants
async function attempt(name, valuesExpr) {
  const st = `create or replace function t_${name}(p_token text, p_label text default null) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint;
begin
  perform admin_verify(p_token);
  insert into backups (label, payload)
  ${valuesExpr}
  returning id into v_id;
  return v_id;
end $$;`
  try { await db.exec(st); console.log('PASS', name) }
  catch (e) { console.log('FAIL', name, '→ pos', e.position) }
}

await attempt('q_var_no_fn',      `values (coalesce(nullif(p_label, ''), ${MB}), backup_payload())`)
await attempt('r_lower_var',      `values (coalesce(nullif(lower(p_label), ''), ${MB}), backup_payload())`)
await attempt('s_btrim_const1st', `values (coalesce(nullif(btrim('abc', ''), ${MB}), backup_payload()))`)
