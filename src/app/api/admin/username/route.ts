import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { newUsername } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_change_username', {
      p_token: adminToken(req),
      p_new_username: String(newUsername ?? ''),
    })
  )
}
