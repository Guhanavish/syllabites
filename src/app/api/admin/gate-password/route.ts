import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse, badRequest } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { newPassword } = await req.json().catch(() => ({}))
  if (typeof newPassword !== 'string' || newPassword.length < 4 || newPassword.length > 200) {
    return badRequest('Password must be 4 to 200 characters')
  }
  return rpcResponse(() =>
    sb().rpc('admin_set_gate_password', {
      p_token: adminToken(req),
      p_new_password: newPassword,
    })
  )
}
