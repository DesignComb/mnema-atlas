import type { MiddlewareHandler } from 'hono'
import type { Env } from './env'

/**
 * Best-effort rate limiting via the Cloudflare Workers Rate Limiting bindings.
 *
 * Authed traffic (/mcp, /rest) is keyed by the API key — NOT by IP, because an
 * external agent (Claude, ChatGPT) connects from its provider's shared egress
 * IPs, so per-IP limits would lump unrelated users together. Keyless discovery
 * (/, /openapi.json, /llms.txt, /.well-known) is keyed by IP to stop anon
 * scraping/floods. Bindings are optional so a missing binding never 500s.
 */
export const rateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const path = new URL(c.req.url).pathname
  if (c.req.method === 'OPTIONS' || path === '/healthz') return next()

  const token = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (token) {
    const rl = c.env.RL_KEY
    if (rl) {
      const { success } = await rl.limit({ key: token })
      if (!success) {
        return c.json({ error: 'rate limited — too many requests for this API key' }, 429, { 'Retry-After': '60' })
      }
    }
  } else {
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
    const rl = c.env.RL_IP
    if (rl) {
      const { success } = await rl.limit({ key: `ip:${ip}` })
      if (!success) {
        return c.json({ error: 'rate limited — slow down' }, 429, { 'Retry-After': '60' })
      }
    }
  }
  return next()
}
