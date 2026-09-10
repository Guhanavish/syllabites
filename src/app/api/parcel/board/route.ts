import { NextRequest, NextResponse } from 'next/server'
import { sb } from '@/lib/supabase'
import { rpcResponse } from '@/lib/server'

/** Staff counter view of entrance (parcel) orders, price-blind, no admin login needed */
export async function GET(_req: NextRequest) {
  return rpcResponse(() => sb().rpc('staff_parcel_board'))
}
