import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

/** Auto-backs-up current data, then restores the chosen backup */
export async function POST(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_restore_backup', {
      p_token: adminToken(req),
      p_backup_id: Number(id),
    })
  )
}
