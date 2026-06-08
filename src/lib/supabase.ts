import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  // Surfaced early in dev so a missing .env is obvious, not a silent 401 later.
  console.warn(
    '[mnema-atlas] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.',
  )
}

/**
 * Browser Supabase client. Uses the *publishable* (anon) key — every read/write
 * is mediated by Row Level Security, so this key is safe to ship to the client.
 * Writes go through SECURITY DEFINER RPCs (see src/lib/api.ts), never raw inserts.
 */
export const supabase = createClient<Database>(url ?? '', publishableKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE so the OAuth redirect carries a ?code= we can exchange. On web,
    // detectSessionInUrl swaps it automatically; in the Capacitor shell, the
    // deep-link handler in auth.tsx calls exchangeCodeForSession explicitly.
    flowType: 'pkce',
  },
})
