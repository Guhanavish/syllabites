import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg, asText } from '@/lib/server'
import { authLimit } from '@/lib/ratelimit'

/** Security-question reset for the common gate password */
export async function POST(req: NextRequest) {
  const limited = authLimit(req)
  if (limited) return limited
  const { answer, newPassword } = await req.json().catch(() => ({}))
  const ans = asText(answer, 200)
  const npw = typeof newPassword === 'string' ? newPassword : ''
  if (!ans || npw.length < 4 || npw.length > 200) {
    return NextResponse.json({ error: 'Reset failed' }, { status: 401 })
  }
  const { data, error } = await sb().rpc('gate_reset', {
    p_answer: ans,
    p_new_password: npw,
  })
  if (error) {
    return NextResponse.json({ error: cleanMsg(error.message || 'Reset failed') }, { status: 401 })
  }
  return NextResponse.json({ version: data })
}
