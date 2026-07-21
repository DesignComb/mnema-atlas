import type { Env } from './env'
import { serviceClient } from './db'

/** SHA-256 hex via Web Crypto (available in the Workers runtime). */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Pull a Bearer token out of the Authorization header. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

export interface ApiKeyAuth {
  userId: string
  /** Scopes the key carries. Add-only keys lack 'edit'; full keys include it. */
  scopes: string[]
}

/**
 * Exchange a plaintext API key for its owner (and the key's scopes) via
 * verify_api_key, which also stamps last_used_at and enforces revoked/expired.
 * Returns null when the key is missing/invalid.
 */
export async function userIdFromApiKey(env: Env, key: string): Promise<ApiKeyAuth | null> {
  const hash = await sha256Hex(key)
  // verify_api_key returns setof (user_id, scopes): one row for a valid key, none otherwise.
  const { data, error } = await serviceClient(env).rpc('verify_api_key', { p_key_hash: hash })
  if (error) throw new Error(error.message)
  const row = (Array.isArray(data) ? data[0] : data) as { user_id?: string; scopes?: string[] } | null
  if (!row?.user_id) return null
  return { userId: row.user_id, scopes: row.scopes ?? [] }
}

/** Resolve the caller (and their key scopes) from a request's Bearer API key. */
export async function authenticate(env: Env, request: Request): Promise<ApiKeyAuth | null> {
  const key = bearerToken(request)
  if (!key) return null
  return userIdFromApiKey(env, key)
}

/**
 * Authenticate the in-app assistant. API keys retain their normal scoped
 * access; a Supabase session belongs to its owner, so it receives full access.
 * This is intentionally not used by MCP or REST, which remain API-key-only.
 */
export async function authenticateAssistant(env: Env, request: Request): Promise<ApiKeyAuth | null> {
  const token = bearerToken(request)
  if (!token) return null
  if (token.startsWith('mk_')) return userIdFromApiKey(env, token)

  const { data, error } = await serviceClient(env).auth.getUser(token)
  if (error || !data.user) return null
  return { userId: data.user.id, scopes: ['create', 'edit'] }
}
