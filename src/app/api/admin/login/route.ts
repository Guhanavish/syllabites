import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { ADMIN_COOKIE, cleanMsg, asText, isProd } from '@/lib/server'
import { authLimit } from '@/lib/ratelimit'

const THIRTY_DAYS = 60 * 60 * 24 * 30

export async function POST(req: NextRequest) {
  const limited = authLimit(req)
  if (limited) return limited
  const { username, password } = await req.json().catch(() => ({}))
  const user = asText(username, 60)
  const pass = typeof password === 'string' ? password : ''
  if (!user || !pass) {
    return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 })
  }
  if (pass.length > 200) {
    return NextResponse.json({ error: 'Password is too long' }, { status: 400 })
  }
  const { data, error } = await sb().rpc('admin_login', {
    p_username: user,
    p_password: pass,
  })
  if (error) {
    return NextResponse.json({ error: cleanMsg(error.message || 'Login failed') }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, String(data), {
    httpOnly: true,
    secure: isProd(),
    sameSite: 'lax',
    path: '/',
    maxAge: THIRTY_DAYS,
  })
  return res
}
