import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse, asText, badRequest } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { section, newPassword } = await req.json().catch(() => ({}))
  const sec = asText(section, 10)
  if (sec !== 'boys' && sec !== 'girls') return badRequest('Invalid section')
  if (typeof newPassword !== 'string' || newPassword.length < 3 || newPassword.length > 200) {
    return badRequest('Password must be 3 to 200 characters')
  }
  return rpcResponse(() => sb().rpc('admin_set_section_password', {
    p_token: adminToken(req),
    p_section: sec,
    p_new_password: newPassword,
  }))
}
