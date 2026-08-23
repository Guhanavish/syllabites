import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { ADMIN_COOKIE, cleanMsg } from '@/lib/server'

const THIRTY_DAYS = 60 * 60 * 24 * 30

export async function POST(req: NextRequest) {
  const { username, password } = await req.json().catch(() => ({}))
  const { data, error } = await sb().rpc('admin_login', {
    p_username: String(username ?? ''),
    p_password: String(password ?? ''),
  })
  if (error) {
    return NextResponse.json({ error: cleanMsg(error.message || 'Login failed') }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, String(data), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  })
  return res
}
