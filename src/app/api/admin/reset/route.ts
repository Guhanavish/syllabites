import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

/** Back up everything on the server, then wipe menu/orders/sales for a fresh start */
export async function POST(req: NextRequest) {
  const { label } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_reset_all', {
      p_token: adminToken(req),
      p_label: label ? String(label) : null,
    })
  )
}
