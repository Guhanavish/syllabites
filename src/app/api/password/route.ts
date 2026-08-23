import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_change_password', {
      p_token: adminToken(req),
      p_current: String(currentPassword ?? ''),
      p_new: String(newPassword ?? ''),
    })
  )
}
