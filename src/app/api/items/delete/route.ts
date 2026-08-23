import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_delete_item', { p_token: adminToken(req), p_id: Number(id) })
  )
}
