import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create extension if not exists pgcrypto;`)
await db.exec(`create table backups (id bigint primary key generated always as identity, label text, payload jsonb, created_at timestamptz default now())`)
await db.exec(`create or replace function admin_verify(p_token text) returns void language plpgsql as $$ begin end $$`)
await db.exec(`create or replace function backup_payload() returns jsonb language sql as $$ select '{}'::jsonb $$`)

async function attempt(name, fnBody) {
  try {
    await db.exec(`create or replace function t_${name}(p_token text, p_label text default null) returns bigint
language plpgsql security definer set search_path = public, extensions as $$\ndeclare\n  v_id bigint;\nbegin\n  perform admin_verify(p_token);\n  insert into backups (label, payload)\n  ${fnBody}\n  returning id into v_id;\n  return v_id;\nend $$;`)
    console.log('PASS', name)
  } catch (e) {
    console.log('FAIL', name, '→', e.message)
  }
}

const MB = `'Manual backup'`
await attempt('i_abs',                 `values (coalesce(nullif(abs(-1), ${MB}), backup_payload()))`)
await attempt('j_btrim_const_empty',   `values (coalesce(nullif(btrim('x', '')), ${MB}), backup_payload()))`.replace('))', ')'))
await attempt('k_btrim_var_space',     `values (coalesce(nullif(btrim(p_label, ' ')), ${MB}), backup_payload()))`.replace('))', ')'))
await attempt('l_nullif_direct_empty', `values (coalesce(nullif(p_label, ''), ${MB}), backup_payload()))`.replace('))', ')'))
