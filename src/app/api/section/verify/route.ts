import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { section, password } = await req.json().catch(() => ({}))
  const { error } = await sb().rpc('verify_section_password', {
    p_section: String(section ?? ''),
    p_password: String(password ?? ''),
  })
  if (error) return NextResponse.json({ error: cleanMsg(error.message) }, { status: 401 })
  return NextResponse.json({ ok: true })
}
