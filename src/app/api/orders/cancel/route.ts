import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse, asInt, asText, badRequest } from '@/lib/server'
import { orderLimit } from '@/lib/ratelimit'

/** Sender cancels with their device token; counter staff pass no token */
export async function POST(req: NextRequest) {
  const limited = orderLimit(req)
  if (limited) return limited
  const { id, clientToken } = await req.json().catch(() => ({}))
  const orderId = asInt(id, NaN)
  if (!Number.isFinite(orderId) || orderId <= 0) return badRequest('Invalid order')
  const token = clientToken ? asText(clientToken, 64) : null
  return rpcResponse(() =>
    sb().rpc('cancel_order', {
      p_order_id: orderId,
      p_client_token: token || null,
    })
  )
}
