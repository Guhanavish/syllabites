# 🚀 Setup — one-time (5 minutes)

## 1. Create the database (required before login works)

1. Open **https://supabase.com/dashboard** and click your project
2. Left sidebar → **SQL Editor** → **New query**
3. Open this file in Notepad: `G:\Foodcourt\web\supabase\schema.sql`
4. **Copy everything**, paste into the SQL Editor, press **Run**
5. Done — you'll see `Success. No rows returned`

This creates the menu/orders tables, security rules, the ordering logic,
and your admin account (`admin` / `admin123`).

## 2. Start the app

```
cd G:\Foodcourt\web
npm run dev
```

Open the printed URL (http://localhost:4000 on the PC, or the Network
address on phones). Admin login now works with `admin` / `admin123`.

## 3. Verify everything (optional but recommended)

With the app running:

```
cd G:\Foodcourt\web
node tests/smoke.mjs
```

Should end with all checks passed. It creates a test item + order, then
cleans them up.

## Deploy to the internet (so phones work without your PC)

Push this folder to GitHub → import into **vercel.com** → add the two
env vars from `.env.local` → deploy. Same code, same database.

## Notes

- Old vanilla version still runs separately via `node server.js`
  (port 3000). Both can run at once.
- Realtime uses Supabase's hosted realtime; counters also poll every
  few seconds as a safety net.
- Change the admin password in **Admin → Settings** after first login.
