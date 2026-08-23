# Syllabites 🍽️

**The campus food court, reimagined.**
Phone-first ordering for Boys & Girls counters — built with Next.js + Supabase.

| Role | What they do |
|---|---|
| **Order Sender** | Browse the menu, tap **+**, hit **Send ➤** — orders reach their counter instantly with a pickup code (B-1, G-7…). Send as many as you like. |
| **Order Receiver** | Live board for one counter. New orders pop in with a chime; one tap marks them **✓ Served**. |
| **Admin** | The only role that can add items, set ₹ prices & stock — and the only one that sees sales & analytics for both counters. |

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** — Postgres + Row Level Security + Realtime
- Zero UI libraries: hand-crafted design system in `globals.css`

All business logic (atomic order codes, stock control, admin auth) lives in
Postgres functions — see [`supabase/schema.sql`](supabase/schema.sql).

## Setup

See [SETUP.md](SETUP.md) — one SQL paste + `npm run dev`.

```
npm install
npm run dev      # http://localhost:4000
```

## Verify

With the app running:

```
node tests/smoke.mjs
```
