import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { items, name, klass, section, eventName } = await req.json().catch(() => ({}))
  const { data, error } = await sb().rpc('public_place_order', {
    p_items: Array.isArray(items) ? items : [],
    p_name: String(name ?? ''),
    p_class: String(klass ?? ''),
    p_section: String(section ?? ''),
    p_event: String(eventName ?? ''),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
