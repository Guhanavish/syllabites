import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

/** Public: place an order (idempotent per clientToken) */
export async function POST(req: NextRequest) {
  const { section, clientToken, items } = await req.json().catch(() => ({}))
  return rpcResponse(
    () =>
      sb().rpc('place_order', {
        p_section: String(section ?? ''),
        p_client_token: String(clientToken ?? ''),
        p_items: Array.isArray(items) ? items : [],
      }),
    201
  )
}
