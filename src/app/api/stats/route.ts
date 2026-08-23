import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') || 'today'
  return rpcResponse(() => sb().rpc('admin_stats', { p_token: adminToken(req), p_range: range }))
}
