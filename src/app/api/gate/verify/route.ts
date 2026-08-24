import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}))
  const { data, error } = await sb().rpc('gate_verify', { p_password: String(password ?? '') })
  if (error) {
    return NextResponse.json({ error: cleanMsg(error.message || 'Wrong password') }, { status: 401 })
  }
  return NextResponse.json({ version: data })
}
