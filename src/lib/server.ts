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
  // PostgREST prefixes our exceptions — show just the friendly part
  if (msg.startsWith('SESSION_EXPIRED')) return 'Session expired — please log in again'
  if (/could not find the (function|table)/i.test(msg) || msg.includes('PGRST202') || msg.includes('PGRST205')) {
    return 'Database not set up yet — open your Supabase dashboard → SQL Editor → paste & Run G:\\Foodcourt\\web\\supabase\\schema.sql'
  }
  return msg.replace(/^error:/i, '').trim()
}
