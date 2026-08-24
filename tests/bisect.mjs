import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create extension if not exists pgcrypto;`)
await db.exec(`create table backups (id bigint primary key generated always as identity, label text, payload jsonb, created_at timestamptz default now())`)

async function attempt(name, fnBody) {
  try {
    await db.exec(`create or replace function t_${name}(p_token text, p_label text default null) returns bigint
language plpgsql security definer set search_path = public, extensions as $$\ndeclare\n  v_id bigint;\nbegin\n  perform admin_verify(p_token);\n  insert into backups (label, payload)\n  ${fnBody}\n  returning id into v_id;\n  return v_id;\nend $$;`)
    console.log('PASS', name)
  } catch (e) {
    console.log('FAIL', name, '→', e.message)
  }
}

await db.exec(`create or replace function admin_verify(p_token text) returns void language plpgsql as $$ begin end $$`)
await db.exec(`create or replace function backup_payload() returns jsonb language sql as $$ select '{}'::jsonb $$`)

await attempt('a_original',   `values (coalesce(nullif(btrim(p_label, '')), 'Manual backup'), backup_payload())`)
await attempt('b_literal',    `values (coalesce(nullif(btrim(p_label, '')), 'Manual backup'), '{}'::jsonb)`)
await attempt('c_no_btrim',   `values (coalesce(nullif(p_label, ''), 'Manual backup'), backup_payload())`)
await attempt('d_plain_label',`values (coalesce(p_label, 'Manual backup'), backup_payload())`)
await attempt('e_multiline',  `values (\n    coalesce(nullif(btrim(p_label, '')), 'Manual backup'),\n    backup_payload()\n  )`)
