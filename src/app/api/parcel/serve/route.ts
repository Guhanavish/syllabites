import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse, asInt, asText, badRequest } from '@/lib/server'
import { orderLimit } from '@/lib/ratelimit'

/** Staff marks an entrance (parcel) order served/cancelled, safe under double-taps */
export async function POST(req: NextRequest) {
  const limited = orderLimit(req)
  if (limited) return limited
  const { id, status } = await req.json().catch(() => ({}))
  const orderId = asInt(id, NaN)
  const st = asText(status, 20)
  if (!Number.isFinite(orderId) || orderId <= 0) return badRequest('Invalid order')
  if (st !== 'completed' && st !== 'cancelled') return badRequest('Invalid status')
  return rpcResponse(() =>
    sb().rpc('staff_serve_public_order', {
      p_order_id: orderId,
      p_status: st,
    })
  )
}
