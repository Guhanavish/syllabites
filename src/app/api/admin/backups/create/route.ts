import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { adminToken, rpcResponse } from '@/lib/server'

/** Snapshot current data into the backups table */
export async function POST(req: NextRequest) {
  const { label } = await req.json().catch(() => ({}))
  return rpcResponse(() =>
    sb().rpc('admin_create_backup', {
      p_token: adminToken(req),
      p_label: label ? String(label) : null,
    }),
    201
  )
}
