/** Cloudflare Workers Rate Limiting binding (minimal surface we use). */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

export interface Env {
  /** Supabase project URL, e.g. https://xyz.supabase.co */
  SUPABASE_URL: string
  /** Service/secret key (sb_secret_…). BYPASSES RLS — server-only, never shipped to the browser. */
  SUPABASE_SECRET_KEY: string
  /** Server-side hackathon key for GPT tool calling. Per-user keys are future work. */
  OPENAI_API_KEY?: string
  /** KV namespace the OAuth provider uses to store grants/tokens (bound in wrangler.toml). */
  OAUTH_KV?: KVNamespace
  /** Per-API-key rate limiter (authed traffic). Optional so a missing binding never 500s. */
  RL_KEY?: RateLimit
  /** Per-IP rate limiter (keyless discovery). */
  RL_IP?: RateLimit
  /** VAPID public key (committed [vars]) — included when signing web-push. */
  VAPID_PUBLIC_KEY?: string
  /** VAPID private key (secret) — signs web-push. Push is disabled until set. */
  VAPID_PRIVATE_KEY?: string
  /** VAPID subject (secret), e.g. mailto:you@example.com */
  VAPID_SUBJECT?: string
  /** Shared secret for the pg_cron → /_cron/run-reminders ping (secret). */
  CRON_SECRET?: string
  /** Public base URL of this worker (committed [vars]); put into push payloads so
   *  the service worker knows where to POST notification actions. */
  WORKER_PUBLIC_URL?: string
  /** Firebase service-account JSON (secret) — signs FCM HTTP v1 sends for native
   *  Android push. Native push is disabled until set. */
  FCM_SERVICE_ACCOUNT?: string
  /** Resend API key (secret) — enables collaborator/notification email. Email is
   *  disabled until set. `wrangler secret put RESEND_API_KEY`. */
  RESEND_API_KEY?: string
  /** Resend "from" address on a Resend-verified domain, e.g. "Mnema <noreply@yourdomain>". */
  RESEND_FROM?: string
  /** Public URL of the web app (e.g. https://app.example.com) — makes email links
   *  absolute. Web-push/FCM use relative URLs (resolved by the app), so this is
   *  only needed for email. */
  APP_PUBLIC_URL?: string
}

export interface ToolContext {
  env: Env
  userId: string
  via: 'mcp' | 'rest'
}
