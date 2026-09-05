import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  return rpcResponse(
    () => sb().rpc('admin_save_parcel_item', { p_token: adminToken(req), p_item: body }),
    201
  )
}
