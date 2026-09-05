import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  return rpcResponse(() =>
    sb().rpc('admin_copy_staff_menu_to_parcel', { p_token: adminToken(req) })
  )
}
