import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

let browserClient: SupabaseClient | null = null

/** Shared anon client. All security lives in the database functions. */
export function sb(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 5 } },
    })
  }
  return browserClient
}

export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data } = await sb().rpc(fn, args).throwOnError()
  return data as T
}
