import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse, badRequest } from '@/lib/server'
import { authLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  const limited = authLimit(req)
  if (limited) return limited
  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return badRequest('Invalid password change request')
  }
  if (newPassword.length < 6 || newPassword.length > 200) {
    return badRequest('New password must be 6 to 200 characters')
  }
  return rpcResponse(() =>
    sb().rpc('admin_change_password', {
      p_token: adminToken(req),
      p_current: currentPassword,
      p_new: newPassword,
    })
  )
}
