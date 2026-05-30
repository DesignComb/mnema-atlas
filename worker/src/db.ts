import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Env } from './env'

/**
 * Service-role Supabase client. Uses the secret key → BYPASSES RLS.
 * Safe only because every write goes through a SECURITY DEFINER RPC that stamps
 * the *resolved* user_id (never a client-supplied one). Server-only.
 */
export function serviceClient(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Call a shared write RPC on behalf of a resolved user. */
export async function callRpc<T = unknown>(
  env: Env,
  userId: string,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await serviceClient(env).rpc(name, { p_user_id: userId, ...args })
  if (error) throw new Error(error.message)
  return data as T
}

/** RLS-bypassing read, manually scoped to the owner (server must filter itself). */
export async function ownedSelect<T = unknown>(
  env: Env,
  userId: string,
  table: string,
  columns: string,
): Promise<T[]> {
  const { data, error } = await serviceClient(env).from(table).select(columns).eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []) as T[]
}
