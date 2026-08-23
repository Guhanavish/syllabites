import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

/** Device posts its stored per-order tokens; DB only returns matching ones */
export async function POST(req: NextRequest) {
  const { tokens } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('my_orders', { p_tokens: Array.isArray(tokens) ? tokens.slice(0, 50) : [] })
  )
}
