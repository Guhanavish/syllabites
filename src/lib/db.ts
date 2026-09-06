'use client'

/**
 * Lightweight browser database client.
 *
 * The full `@supabase/supabase-js` bundle (~231KB: realtime + auth + storage)
 * ships to every phone, but this app only ever uses realtime channels and
 * plain table reads — auth/storage are dead weight on a cold first load.
 * This module talks to the same Supabase project with just
 * `@supabase/postgrest-js` + `@supabase/realtime-js`, which are already
 * installed as transitive dependencies. Same project, same tables, same
 * realtime events — only the unused code is gone.
 *
 * Server routes (`src/app/api/*`) keep using `@/lib/supabase` (supabase-js);
 * server bundle size never affects first paint.
 */
import { PostgrestClient } from '@supabase/postgrest-js'
import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/** Only the columns any menu UI reads — narrower payloads, faster parse. */
const MENU_COLS = 'id,name,emoji,category,price,stock,available'

let pg: PostgrestClient | null = null
let rt: RealtimeClient | null = null

function rest(): PostgrestClient {
  if (!pg) {
    pg = new PostgrestClient(url + '/rest/v1', {
      headers: { apikey: key, Authorization: 'Bearer ' + key },
    })
  }
  return pg
}

function live(): RealtimeClient {
  if (!rt) {
    // Same endpoint + auth shape supabase-js itself uses internally.
    const realtimeUrl = new URL('realtime/v1', url).href
    rt = new RealtimeClient(realtimeUrl, {
      params: { apikey: key, eventsPerSecond: 5 },
    })
  }
  return rt
}

export type BrowserDb = {
  from: PostgrestClient['from']
  channel: (name: string) => RealtimeChannel
  removeChannel: (ch: RealtimeChannel) => Promise<unknown>
}

/** Drop-in for the browser-side `sb()` calls (realtime + table reads). */
export function db(): BrowserDb {
  const client = rest()
  const socket = live()
  return {
    from: (table: string) => client.from(table),
    channel: (name: string) => socket.channel(name),
    removeChannel: (ch: RealtimeChannel) => socket.removeChannel(ch),
  }
}

/* In-flight menu reads, shared across components so concurrent mounts
   (and the cold-start warm-up below) issue ONE request, not N. Promise is
   dropped as soon as it settles — no stale data is ever served. */
const inflight = new Map<string, Promise<any[]>>()

export function fetchMenu(table: 'items' | 'parcel_items'): Promise<any[]> {
  const hit = inflight.get(table)
  if (hit) return hit
  const p = (async () => {
    const { data, error } = await rest().from(table).select(MENU_COLS).order('id')
    if (error) throw error
    return (data || []) as any[]
  })()
  inflight.set(table, p)
  p.then(
    () => { if (inflight.get(table) === p) inflight.delete(table) },
    () => { if (inflight.get(table) === p) inflight.delete(table) }
  )
  return p
}

let warmed = false
/**
 * Fired once on app mount, in parallel with the gate check: warms the
 * parcel menu (public, shown on the default Order tab) and — on returning
 * devices — the staff menu for the remembered section. Components reuse the
 * in-flight request, so by first tap the data is already here.
 */
export function warmCritical(): void {
  if (warmed) return
  warmed = true
  try {
    fetchMenu('parcel_items').catch(() => {})
    const s = localStorage.getItem('fc.section')
    if (s === 'boys' || s === 'girls') fetchMenu('items').catch(() => {})
  } catch {}
}
