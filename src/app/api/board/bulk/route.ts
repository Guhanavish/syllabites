import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'

// Bulk fetch for both counters in one round-trip (reduces latency vs 2 separate calls)
// GET /api/board/bulk?sections=boys,girls
export async function GET(req: NextRequest) {
  const sections = (req.nextUrl.searchParams.get('sections') || 'boys,girls').split(',').map(s=>s.trim()).filter(Boolean)
  const valid = sections.filter(s=> s==='boys' || s==='girls') as ('boys'|'girls')[]
  const toFetch = valid.length ? valid : ['boys','girls'] as const
  // Bulk: parallel RPCs in single server tick (coalesced)
  const results = await Promise.all(
    toFetch.map(async (sec) => {
      const { data, error } = await sb().rpc('counter_board', { p_section: sec })
      if (error) return [sec, { active: [], doneToday: { count:0, revenue:0 }, doneOrders: [] }] as const
      return [sec, data] as const
    })
  )
  const out: Record<string, any> = {}
  for (const [sec, data] of results) out[sec] = data
  return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } })
}
