import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { section, password } = await req.json().catch(() => ({}))
  const sec = String(section ?? '')
  const pw = String(password ?? '')
  const { error } = await sb().rpc('verify_section_password', {
    p_section: sec,
    p_password: pw,
  })
  if (error) {
    // Fallback for DBs where schema hasn't been re-run yet (function/table missing)
    const isMissingDb = /could not find the (function|table)/i.test(error.message) || error.message.includes('PGRST202') || error.message.includes('PGRST205')
    if (isMissingDb) {
      const defaults: Record<string, string> = { boys: 'boyzz', girls: 'girls' }
      if (defaults[sec] && pw === defaults[sec]) return NextResponse.json({ ok: true })
      return NextResponse.json({ error: `Wrong password for ${sec.charAt(0).toUpperCase() + sec.slice(1)}` }, { status: 401 })
    }
    return NextResponse.json({ error: cleanMsg(error.message) }, { status: 401 })
  }
  return NextResponse.json({ ok: true })
}
