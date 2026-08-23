import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, cleanMsg } from '@/lib/server'

/** Used by the admin dashboard on load to see if the session is alive */
export async function GET(req: NextRequest) {
  const token = adminToken(req)
  if (!token) return NextResponse.json({ error: 'SESSION_EXPIRED: no session' }, { status: 401 })
  const { error } = await sb().rpc('admin_verify', { p_token: token })
  if (error) return NextResponse.json({ error: cleanMsg(error.message || 'Session expired') }, { status: 401 })
  return NextResponse.json({ ok: true })
}
