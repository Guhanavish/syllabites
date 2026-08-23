import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { ADMIN_COOKIE, adminToken } from '@/lib/server'

export async function POST(req: NextRequest) {
  const token = adminToken(req)
  if (token) {
    try { await sb().rpc('admin_logout', { p_token: token }) } catch {}
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
