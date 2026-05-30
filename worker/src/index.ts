import { Hono } from 'hono'
import { authenticate } from './auth'
import { handleMcpRequest } from './mcp'
import { rest } from './rest'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

app.get('/healthz', (c) => c.json({ ok: true, service: 'mnema-atlas-worker' }))

app.get('/', (c) =>
  c.text('Mnema Atlas worker. Endpoints: POST /mcp (MCP Streamable HTTP), /rest (REST API), /healthz'),
)

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
