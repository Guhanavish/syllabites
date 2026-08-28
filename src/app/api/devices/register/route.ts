import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { deviceId, section, role } = await req.json().catch(() => ({}))
  const { error } = await sb().rpc('register_device', {
    p_device_id: String(deviceId ?? ''),
    p_section: String(section ?? ''),
    p_role: String(role ?? ''),
  })
  if (error) {
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
