import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate } from './auth'
import { handleMcpRequest } from './mcp'
import { rest } from './rest'
import { rateLimit } from './ratelimit'
import { buildOpenApiSpec } from './openapi'
import { buildLlmsTxt } from './llms'
import { discoveryIndex } from './discovery'
import { runReminderScan, runDailyReviewScan, runTodoDigestScan, runHabitReminderScan, runCollaboratorNotifyScan, scheduled } from './scheduled'
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

// Public-holiday proxy (so the browser isn't blocked by Nager.Date's CORS).
// Fetches server-side, edge-cached a day, returns a slim {date,name}[] with our
// own permissive CORS. Used by the Tempo calendar's Holidays calendar.
app.get('/holidays/:country/:year', async (c) => {
  const country = (c.req.param('country') || '').toUpperCase().slice(0, 2)
  const year = parseInt(c.req.param('year') || '', 10)
  if (!/^[A-Z]{2}$/.test(country) || !Number.isFinite(year) || year < 1975 || year > 2100) {
    return c.json([], 200)
  }
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, {
      cf: { cacheTtl: 86400, cacheEverything: true },
    } as RequestInit)
    if (!res.ok) return c.json([], 200)
    const data = (await res.json()) as Array<{ date: string; localName?: string; name?: string }>
    const slim = data.map((h) => ({ date: h.date, name: h.localName || h.name || '' }))
    return c.json(slim, 200, { 'Cache-Control': 'public, max-age=86400' })
  } catch {
    return c.json([], 200)
  }
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

// Reminder sweep, pinged every minute by a Supabase pg_cron job (guarded by a
// shared secret). This stands in for a Cloudflare Cron Trigger, which needs a
// workers.dev subdomain on the account.
app.post('/_cron/run-reminders', async (c) => {
  if (!c.env.CRON_SECRET || c.req.header('x-cron-secret') !== c.env.CRON_SECRET) {
    return c.json({ error: 'forbidden' }, 403)
  }
  c.executionCtx.waitUntil(runReminderScan(c.env))
  // Daily to-do digest + habit deadline nudges ride this same per-minute ping
  // (each self-gates on the clock).
  c.executionCtx.waitUntil(runTodoDigestScan(c.env))
  c.executionCtx.waitUntil(runHabitReminderScan(c.env))
  // Collaborator-added notifications (push now; email once Resend is set) also
  // ride this per-minute ping — recipients hear within ~1 minute of being added.
  c.executionCtx.waitUntil(runCollaboratorNotifyScan(c.env))
  return c.json({ ok: true })
})

// Daily end-of-day review sweep. Schedule this once each evening from pg_cron
// (e.g. 0 21 * * *), same shared-secret guard as the reminder sweep.
app.post('/_cron/run-daily-reviews', async (c) => {
  if (!c.env.CRON_SECRET || c.req.header('x-cron-secret') !== c.env.CRON_SECRET) {
    return c.json({ error: 'forbidden' }, 403)
  }
  c.executionCtx.waitUntil(runDailyReviewScan(c.env))
  return c.json({ ok: true })
})

// Notification-action callback from the service worker (延後 / 已完成 buttons).
// The SW has no API key — it identifies the user by its OWN push subscription
// endpoint (a per-user secret already stored in push_subscriptions), which we
// resolve server-side, then run the action with the service-role client.
app.post('/_action', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body.endpoint !== 'string' || typeof body.action !== 'string') {
    return c.json({ error: 'bad request' }, 400)
  }
  const sb = serviceClient(c.env)
  const { data: uid } = await sb.rpc('user_id_for_push_endpoint', { p_endpoint: body.endpoint })
  if (!uid) return c.json({ error: 'unknown subscription' }, 403)
  try {
    if (body.action === 'done' && typeof body.task_id === 'string') {
      await sb.rpc('complete_task', { p_user_id: uid, p_task_id: body.task_id })
    } else if (body.action === 'checkin' && typeof body.task_id === 'string') {
      // Pin the check-in to the habit-day the nudge was about, so a tap just AFTER
      // the reset boundary still saves that day (not the freshly-started one).
      await sb.rpc('check_in', {
        p_user_id: uid,
        p_task_id: body.task_id,
        p_checkin_date: typeof body.checkin_date === 'string' ? body.checkin_date : undefined,
      })
    } else if (body.action === 'snooze' && typeof body.reminder_id === 'string') {
      await sb.rpc('snooze_reminder', { p_user_id: uid, p_reminder_id: body.reminder_id, p_minutes: 60 })
    } else {
      return c.json({ error: 'bad action' }, 400)
    }
  } catch {
    return c.json({ error: 'action failed' }, 500)
  }
  return c.json({ ok: true })
})

export default { fetch: app.fetch, scheduled }
