import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function GET(req: NextRequest) {
  return rpcResponse(() => sb().rpc('admin_list_parcel_items', { p_token: adminToken(req) }))
}
