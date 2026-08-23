'use client'

/* thin fetch wrapper for our /api routes */
export async function api<T = any>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw { status: 0, message: 'Cannot reach the server. Check your connection.' }
  }
  let data: any = {}
  try { data = await res.json() } catch {}
  if (!res.ok) {
    const msg: string = data.error || `Request failed (${res.status})`
    const err: any = { status: res.status, message: msg }
    if (msg.startsWith('SESSION_EXPIRED')) err.sessionExpired = true
    throw err
  }
  return data as T
}

/** true if error is a dead admin session */
export function isSessionExpired(e: any): boolean {
  return e?.sessionExpired === true || (e?.status === 401 && String(e?.message || '').includes('SESSION'))
}
