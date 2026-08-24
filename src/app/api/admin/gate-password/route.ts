import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { newPassword } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_set_gate_password', {
      p_token: adminToken(req),
      p_new_password: String(newPassword ?? ''),
    })
  )
}
