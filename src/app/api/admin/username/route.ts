import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse, asText, badRequest } from '@/lib/server'

export async function POST(req: NextRequest) {
  const { newUsername } = await req.json().catch(() => ({}))
  const name = asText(newUsername, 60)
  if (!name) return badRequest('Username is required')
  return rpcResponse(() =>
    sb().rpc('admin_change_username', {
      p_token: adminToken(req),
      p_new_username: name,
    })
  )
}
