export interface Env {
  /** Supabase project URL, e.g. https://xyz.supabase.co */
  SUPABASE_URL: string
  /** Service/secret key (sb_secret_…). BYPASSES RLS — server-only, never shipped to the browser. */
  SUPABASE_SECRET_KEY: string
  /** KV namespace the OAuth provider uses to store grants/tokens (bound in wrangler.toml). */
  OAUTH_KV?: KVNamespace
}

export interface ToolContext {
  env: Env
  userId: string
  via: 'mcp' | 'rest'
}
