import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg } from '@/lib/server'
import { authLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = authLimit(req)
  if (limited) return limited
  const { password } = await req.json().catch(() => ({}))
  if (typeof password !== 'string' || !password || password.length > 200) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
  }
  const { data, error } = await sb().rpc('gate_verify', { p_password: password })
  if (error) {
    return NextResponse.json({ error: cleanMsg(error.message || 'Wrong password') }, { status: 401 })
  }
  return NextResponse.json({ version: data })
}
