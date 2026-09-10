import { NextRequest, NextResponse } from 'next/server'

/* Tiny in-memory token-bucket rate limiter for abuse-prone API routes
   (login, password verify/reset, order placement). Per-instance memory is
   enough here: Vercel runs few instances and the database RPCs remain the
   real source of truth. Limits are generous for counter use. */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

export function rateLimit(
  req: NextRequest,
  opts: { key: string; limit: number; windowMs: number }
): NextResponse | null {
  const now = Date.now()
  const bucketKey = `${opts.key}:${clientIp(req)}`
  let b = buckets.get(bucketKey)
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + opts.windowMs }
    buckets.set(bucketKey, b)
  }
  b.count += 1
  if (b.count > opts.limit) {
    const retryAfter = Math.max(1, Math.ceil((b.resetAt - now) / 1000))
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }
  // Prevent unbounded growth on long-lived instances.
  if (buckets.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k)
    }
  }
  return null
}

/** Strict bucket for auth endpoints: 20 attempts per minute per IP. */
export function authLimit(req: NextRequest): NextResponse | null {
  return rateLimit(req, { key: 'auth', limit: 20, windowMs: 60_000 })
}

/** Generous bucket for order placement: 60 per minute per IP. */
export function orderLimit(req: NextRequest): NextResponse | null {
  return rateLimit(req, { key: 'order', limit: 60, windowMs: 60_000 })
}
