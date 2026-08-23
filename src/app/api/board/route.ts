import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

export async function GET(req: NextRequest) {
  const section = req.nextUrl.searchParams.get('section') || ''
  return rpcResponse(() => sb().rpc('counter_board', { p_section: section }))
}
