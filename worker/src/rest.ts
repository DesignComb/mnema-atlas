import { Hono } from 'hono'
import { authenticate } from './auth'
import { toolAllowed, toolByName, tools } from './tools'
import type { Env } from './env'

/**
 * REST fallback. Same auth model (Bearer API key) and the SAME shared tool
 * registry as MCP, so a curl call and an AI tool call produce identical writes.
 * Mounted at /rest by index.ts.
 */
export const rest = new Hono<{ Bindings: Env; Variables: { userId: string; scopes: string[] } }>()

rest.use('*', async (c, next) => {
  const auth = await authenticate(c.env, c.req.raw)
  if (!auth)
    return c.json({ error: 'unauthorized: send a valid Bearer API key' }, 401, {
      'WWW-Authenticate': 'Bearer realm="mnema-atlas"',
    })
  c.set('userId', auth.userId)
  c.set('scopes', auth.scopes)
  await next()
})

// GET /rest → discover available tools.
rest.get('/', (c) =>
  c.json({
    tools: tools.map((t) => ({ name: t.name, description: t.description, readOnly: t.readOnly })),
  }),
)

// POST /rest/:tool → run a tool with a JSON body validated by the shared schema.
rest.post('/:tool', async (c) => {
  const tool = toolByName.get(c.req.param('tool'))
  if (!tool) return c.json({ error: 'unknown tool' }, 404)

  if (!toolAllowed(tool, c.get('scopes'))) {
    return c.json(
      { error: `forbidden: this key is add-only and cannot call '${tool.name}' (needs the 'edit' scope)` },
      403,
    )
  }

  const body = await c.req.json().catch(() => ({}))
  const parsed = tool.schema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'invalid input', issues: parsed.error.issues }, 400)
  }

  try {
    const result = await tool.run(
      { env: c.env, userId: c.get('userId'), via: 'rest' },
      parsed.data as Record<string, unknown>,
    )
    return c.json({ ok: true, summary: result.summary, data: result.data })
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : 'internal error' }, 500)
  }
})
