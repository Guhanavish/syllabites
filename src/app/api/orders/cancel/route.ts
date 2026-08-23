import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

/** Sender cancels with their device token; counter staff pass no token */
export async function POST(req: NextRequest) {
  const { id, clientToken } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('cancel_order', {
      p_order_id: Number(id),
      p_client_token: clientToken ? String(clientToken) : null,
    })
  )
}
