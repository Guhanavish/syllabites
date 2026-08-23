import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

/** Counter action: mark served */
export async function POST(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('set_order_status', { p_order_id: Number(id), p_status: String(status ?? '') })
  )
}
