import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
const db = new PGlite({ extensions: { pgcrypto } })
await db.exec(`create extension if not exists pgcrypto;`)
await db.exec(`create table backups (id bigint primary key generated always as identity, label text, payload jsonb, created_at timestamptz default now())`)
await db.exec(`create or replace function admin_verify(p_token text) returns void language plpgsql as $$ begin end $$`)
await db.exec(`create or replace function backup_payload() returns jsonb language sql as $$ select '{}'::jsonb $$`)

async function attempt(name, valuesExpr) {
  const stmt = `create or replace function t_${name}(p_token text, p_label text default null) returns bigint
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
  console.log('\n───', name)
  console.log(valuesExpr.split('\n').map((l) => '   | ' + l).join('\n'))
  try {
    await db.exec(stmt)
    console.log('   PASS')
  } catch (e) {
    console.log('   FAIL →', e.message, '| where:', JSON.stringify(e.where ?? null), '| position:', e.position ?? null)
  }
}

await attempt('m_exact_original', `values (coalesce(nullif(btrim(p_label, '')), 'Manual backup'), backup_payload())`)
await attempt('n_btrim_space',    `values (coalesce(nullif(btrim(p_label, ' ')), 'Manual backup'), backup_payload())`)
await attempt('o_no_nullif',      `values (coalesce(btrim(p_label, ''), 'Manual backup'), backup_payload())`)
