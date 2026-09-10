import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_COOKIE = 'fc_admin'

export function adminToken(req: NextRequest): string | null {
  return req.cookies.get(ADMIN_COOKIE)?.value || null
}

/** Wrap a Supabase RPC call into a JSON response with clean errors. */
export async function rpcResponse<T>(
  run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  okStatus = 200
): Promise<NextResponse> {
  try {
    const { data, error } = await run()
    if (error) {
      const msg = error.message || 'Database error'
      const status = msg.startsWith('SESSION_EXPIRED') ? 401 : 400
      return NextResponse.json({ error: cleanMsg(msg) }, { status })
    }
    return NextResponse.json(data ?? { ok: true }, { status: okStatus })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}

export function cleanMsg(msg: string): string {
  // PostgREST prefixes our exceptions, show just the friendly part
  if (msg.startsWith('SESSION_EXPIRED')) return 'Session expired. Please log in again'
  if (/could not find the (function|table)/i.test(msg) || msg.includes('PGRST202') || msg.includes('PGRST205')) {
    return 'Database not set up yet. Open Supabase dashboard, SQL Editor, then paste and run supabase/schema.sql'
  }
  return msg.replace(/^error:/i, '').trim()
}

/* ---------- server-side input validation ----------
   Every public API route funnels through these helpers before touching
   the database, so oversized or mistyped payloads are rejected with a
   clean 400 instead of reaching PostgREST. The SQL functions validate
   again. Defense in depth, no new dependencies. */

export function asText(v: unknown, max = 120): string {
  const s = typeof v === 'string' ? v : v == null ? '' : String(v)
  return s.trim().slice(0, max)
}

export function asInt(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? Math.trunc(n) : fallback
}

export type CartLine = { itemId: number; qty: number }

/** Clamp order lines to sane bounds (per-item caps are enforced in SQL). */
export function asCartLines(v: unknown, maxLines = 50, maxQty = 30): CartLine[] | null {
  if (!Array.isArray(v) || v.length === 0 || v.length > maxLines) return null
  const out: CartLine[] = []
  for (const row of v) {
    if (typeof row !== 'object' || row === null) return null
    const itemId = asInt((row as Record<string, unknown>).itemId, NaN)
    const qty = asInt((row as Record<string, unknown>).qty, NaN)
    if (!Number.isFinite(itemId) || itemId <= 0) return null
    if (!Number.isFinite(qty) || qty <= 0 || qty > maxQty) return null
    out.push({ itemId, qty })
  }
  return out
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}
