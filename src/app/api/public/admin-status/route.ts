import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  return rpcResponse(() => sb().rpc('admin_update_public_order_status', { p_token: adminToken(req), p_order_id: Number(id), p_status: String(status ?? '') }))
}
