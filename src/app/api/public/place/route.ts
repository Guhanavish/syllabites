import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const { items } = await req.json().catch(() => ({}))
  const { data, error } = await sb().rpc('public_place_order', { p_items: Array.isArray(items) ? items : [] })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data, { status: 201 })
}
