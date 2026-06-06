# Self-hosting Mnema

Run your own instance with **your own Supabase project** + **your own Cloudflare**. Everything is env-driven; the only hard requirement is **Supabase** (the app's auth, RLS and write-path RPCs are built on it — a generic Postgres is a rewrite, not a config swap).

> The data layer is portable Postgres (migrations need only `pgcrypto`), but auth = Supabase Auth (Google), and every RLS policy uses `auth.uid()`. Plan to use Supabase (cloud free tier, or self-hosted via Docker).

## 1 · Supabase project
1. Create a project (free tier is plenty: 500 MB DB / 1 GB storage / 50k MAU; **note it auto-pauses after 7 days with no DB requests**).
2. Apply the schema — **all** migrations in order, including the `0011` security hardening that revokes `anon` execute and the `0025` Storage bucket:
   ```bash
   supabase link --project-ref <your-ref>   # config.toml is committed, so this works from a clean clone
   supabase db push                          # or: npm run db:push
   ```
   (No CLI? Paste each file in `supabase/migrations/` into the dashboard SQL Editor, in numeric order.)
3. **Google sign-in** (the only login): create a Google OAuth client (Cloud Console → Credentials), then Supabase → **Auth → Providers → Google** → paste the client id/secret. Under **Auth → URL Configuration** set **Site URL** to your frontend origin and add it to **Redirect URLs** (e.g. `https://app.example.com`). Email/password logins stay off.

## 2 · Worker (Cloudflare)
The MCP + REST API for connected AIs.
1. Edit `worker/wrangler.toml`: change `name`, and either repoint the `routes` custom domain to your Cloudflare zone **or delete the `routes` block** to use the free `https://<name>.<subdomain>.workers.dev` URL.
2. Set secrets (server-only — never in the browser bundle):
   ```bash
   cd worker
   npx wrangler secret put SUPABASE_URL          # https://<your-ref>.supabase.co
   npx wrangler secret put SUPABASE_SECRET_KEY   # service/secret key — bypasses RLS
   # optional web-push: VAPID_PUBLIC_KEY (in [vars]), VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
   npx wrangler deploy
   ```

## 3 · Frontend
Static SPA — host anywhere (Cloudflare Pages, Netlify, Vercel, nginx).
1. `cp .env.example .env.local` and fill in **your** values:
   ```
   VITE_SUPABASE_URL=https://<your-ref>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   VITE_MCP_URL=https://<your-worker>/mcp     # required — no fallback; blank = broken on purpose
   VITE_REST_URL=https://<your-worker>/rest
   ```
2. `npm install && npm run build` → deploy `dist/`.

> **Using GitHub Actions?** `.github/workflows/deploy.yml` reads repo **Variables** (Settings → Secrets and variables → Actions → Variables): `CLOUDFLARE_ACCOUNT_ID`, `CF_PAGES_PROJECT`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MCP_URL`, `VITE_REST_URL`, plus the `CLOUDFLARE_API_TOKEN` secret. Unset → the maintainer's defaults (don't deploy a fork without setting them).

## 4 · Connect an AI
Sign in, then **Settings → Connect an AI** to mint an API key (add-only by default) and copy the MCP/REST snippets for Claude, Cursor, a custom GPT, Le Chat, etc.

## Notes & gotchas
- **Reminders (web-push)** need a periodic ping to the Worker's `/_cron/run-reminders` (with `CRON_SECRET`). Cloudflare cron needs a `workers.dev` subdomain (open Workers & Pages once to auto-create it); otherwise schedule it from Supabase (`pg_cron` + `pg_net`) or any external cron.
- **Image uploads** use the `uploads` Storage bucket from migration `0025` (public read, per-user write) — nothing else to provision.
- **Back up** your Supabase DB (dashboard backups on paid tiers, or `pg_dump`).
