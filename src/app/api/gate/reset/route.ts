import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg } from '@/lib/server'

/** Security-question reset for the common gate password */
export async function POST(req: NextRequest) {
  const { answer, newPassword } = await req.json().catch(() => ({}))
  const { data, error } = await sb().rpc('gate_reset', {
    p_answer: String(answer ?? ''),
    p_new_password: String(newPassword ?? ''),
  })
  if (error) {
    return NextResponse.json({ error: cleanMsg(error.message || 'Reset failed') }, { status: 401 })
  }
  return NextResponse.json({ version: data })
}
