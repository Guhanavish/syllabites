import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse, asCartLines, asText, badRequest } from '@/lib/server'
import { orderLimit } from '@/lib/ratelimit'

/** Public: place an order (idempotent per clientToken) */
export async function POST(req: NextRequest) {
  const limited = orderLimit(req)
  if (limited) return limited
  const { section, clientToken, items } = await req.json().catch(() => ({}))
  const sec = asText(section, 10)
  if (sec !== 'boys' && sec !== 'girls') return badRequest('Invalid counter')
  const token = asText(clientToken, 64)
  if (!token) return badRequest('Missing order token. Please retry.')
  const lines = asCartLines(items, 50, 30)
  if (!lines) return badRequest('Invalid items in order')
  return rpcResponse(
    () =>
      sb().rpc('place_order', {
        p_section: sec,
        p_client_token: token,
        p_items: lines,
      }),
    201
  )
}
