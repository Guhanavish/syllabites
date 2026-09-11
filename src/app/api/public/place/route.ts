import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { asCartLines, asText } from '@/lib/server'
import { orderLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = orderLimit(req)
  if (limited) return limited
  const { items, name, klass, section, eventName, company } = await req.json().catch(() => ({}))
  // Honeypot: silently reject bot submissions that fill the hidden field.
  if (typeof company === 'string' && company.trim() !== '') {
    return NextResponse.json({ error: 'Could not place order' }, { status: 400 })
  }
  const lines = asCartLines(items, 50, 10)
  const cName = asText(name, 60)
  const cKlass = asText(klass, 30)
  const cSection = asText(section, 30)
  const cEvent = asText(eventName, 60)
  if (!lines) return NextResponse.json({ error: 'Invalid items in order' }, { status: 400 })
  if (!cName || !cKlass || !cSection || !cEvent) {
    return NextResponse.json({ error: 'Please fill Name, Class, Section and Event' }, { status: 400 })
  }
  const { data, error } = await sb().rpc('public_place_order', {
    p_items: lines,
    p_name: cName,
    p_class: cKlass,
    p_section: cSection,
    p_event: cEvent,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
