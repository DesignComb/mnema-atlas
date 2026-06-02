import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate } from './auth'
import { handleMcpRequest } from './mcp'
import { rest } from './rest'
import { rateLimit } from './ratelimit'
import { buildOpenApiSpec } from './openapi'
import { buildLlmsTxt } from './llms'
import { discoveryIndex } from './discovery'
import { scheduled } from './scheduled'
import { serviceClient } from './db'
import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

// Let browser clients (the in-app Tools page, bookmarklets) call the API cross-origin.
app.use(
  '*',
  cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'OPTIONS'] }),
)

// Structured access log (one JSON line per request) for observability.
app.use('*', async (c, next) => {
  const start = Date.now()
  await next()
  console.log(
    JSON.stringify({
      t: 'req',
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      ms: Date.now() - start,
      keyed: Boolean(c.req.header('authorization')),
    }),
  )
})

// Best-effort rate limiting (per-key for authed, per-IP for keyless).
app.use('*', rateLimit)

const reqOrigin = (url: string) => new URL(url).origin

app.get('/healthz', (c) => c.json({ ok: true, service: 'mnema-atlas-worker' }))

// ── Public, keyless discovery surface ────────────────────────────────────────
// Lets any agent bootstrap (read the tools + how to auth) before it has a key.
app.get('/', (c) =>
  c.json(discoveryIndex(reqOrigin(c.req.url)), 200, {
    'X-Mnema-Docs': `${reqOrigin(c.req.url)}/openapi.json`,
  }),
)
app.get('/openapi.json', (c) => c.json(buildOpenApiSpec(reqOrigin(c.req.url))))
app.get('/llms.txt', (c) =>
  c.text(buildLlmsTxt(reqOrigin(c.req.url)), 200, { 'Content-Type': 'text/plain; charset=utf-8' }),
)
app.get('/.well-known/mnema', (c) => c.json(discoveryIndex(reqOrigin(c.req.url))))

/**
 * MCP endpoint (Streamable HTTP, stateless).
 * Auth today: Bearer API key — works with Claude Code, Cursor, and the Claude
 * API mcp-connector. The claude.ai web/desktop connector requires OAuth 2.1;
 * wrap this app with @cloudflare/workers-oauth-provider to enable it (see README).
 */
app.all('/mcp', async (c) => {
  const auth = await authenticate(c.env, c.req.raw)
  if (!auth) {
    return c.json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer realm="mnema-atlas"' })
  }
  return handleMcpRequest(c.env, auth.userId, auth.scopes, c.req.raw)
})

app.route('/rest', rest)

// Debug: send a test push to the authenticated caller's own subscriptions.
// Use this to verify VAPID/encryption before relying on the cron.
app.post('/_debug/testpush', async (c) => {
  const auth = await authenticate(c.env, c.req.raw)
  if (!auth) return c.json({ error: 'unauthorized' }, 401)
  const env = c.env
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY) {
    return c.json({ error: 'push not configured (set VAPID_PRIVATE_KEY + VAPID_SUBJECT secrets)' }, 503)
  }
  const sb = serviceClient(env)
  const { data } = await sb.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', auth.userId)
  const subs = (data ?? []) as { endpoint: string; p256dh: string; auth: string }[]
  const vapid = { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
  const results = await Promise.all(
    subs.map(async (s) => {
      try {
        const payload = await buildPushPayload(
          { data: { title: 'Mnema Tempo', body: 'Test reminder ✓', url: '/tempo' } },
          { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
          vapid,
        )
        const res = await fetch(s.endpoint, payload)
        return res.status
      } catch (e) {
        return e instanceof Error ? e.message : 'error'
      }
    }),
  )
  return c.json({ sent: subs.length, results })
})

export default { fetch: app.fetch, scheduled }
