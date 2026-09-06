import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

/** Staff marks an entrance (parcel) order served/cancelled — safe under double-taps */
export async function POST(req: NextRequest) {
  const { id, status } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('staff_serve_public_order', {
      p_order_id: Number(id),
      p_status: String(status ?? ''),
    })
  )
}
