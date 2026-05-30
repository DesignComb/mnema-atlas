import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate } from './auth'
import { handleMcpRequest } from './mcp'
import { rest } from './rest'
import { buildOpenApiSpec } from './openapi'
import { buildLlmsTxt } from './llms'
import { discoveryIndex } from './discovery'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

// Let browser clients (the in-app Tools page, bookmarklets) call the API cross-origin.
app.use(
  '*',
  cors({ origin: '*', allowHeaders: ['Authorization', 'Content-Type'], allowMethods: ['GET', 'POST', 'OPTIONS'] }),
)

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

export default app
