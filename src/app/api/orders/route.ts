import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  return rpcResponse(() =>
    sb().rpc('admin_orders_list', {
      p_token: adminToken(req),
      p_section: q.get('section') || 'all',
      p_status: q.get('status') || 'all',
      p_today: q.get('today') !== 'false',
    })
  )
}
