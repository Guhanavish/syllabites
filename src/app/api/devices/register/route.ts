import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { asText } from '@/lib/server'
import { rateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: 'device', limit: 60, windowMs: 60_000 })
  if (limited) return limited
  const { deviceId, section, role } = await req.json().catch(() => ({}))
  const did = asText(deviceId, 64)
  const sec = asText(section, 20)
  const r = asText(role, 20)
  if (!did || (sec !== 'boys' && sec !== 'girls' && sec !== 'entrance' && sec !== '')) {
    return NextResponse.json({ error: 'Invalid device registration' }, { status: 400 })
  }
  if (r !== 'sender' && r !== 'receiver' && r !== 'parcel' && r !== '') {
    return NextResponse.json({ error: 'Invalid device registration' }, { status: 400 })
  }
  const { error } = await sb().rpc('register_device', {
    p_device_id: did,
    p_section: sec,
    p_role: r,
  })
  if (error) {
    return NextResponse.json({ error: error.message || 'Registration failed' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
