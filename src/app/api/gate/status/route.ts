import { NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { cleanMsg } from '@/lib/server'

/** Public: current gate version so unlocked devices can detect changes */
export async function GET() {
  const { data, error } = await sb().rpc('gate_version')
  if (error) return NextResponse.json({ error: cleanMsg(error.message) }, { status: 400 })
  return NextResponse.json({ version: data })
}
