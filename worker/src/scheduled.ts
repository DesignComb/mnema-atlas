import { buildPushPayload } from '@block65/webcrypto-web-push'
import { serviceClient } from './db'
import type { Env } from './env'

interface DueReminder {
  reminder_id: string
  task_id: string
  title: string
  body: string
  subscriptions: { endpoint: string; p256dh: string; auth: string }[]
}

/**
 * Cron entrypoint: find reminders whose time has passed and deliver them via
 * Web Push. Idempotent — due_reminders_for_cron only returns status='pending'
 * rows and we flip them to 'sent', so an at-least-once cron never double-sends.
 */
export async function runReminderScan(env: Env): Promise<void> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY) return // push not configured yet
  const sb = serviceClient(env)
  const { data, error } = await sb.rpc('due_reminders_for_cron')
  if (error || !Array.isArray(data)) return
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }

  await Promise.allSettled(
    (data as DueReminder[]).map(async (r) => {
      await Promise.allSettled(
        r.subscriptions.map(async (s) => {
          const subscription = {
            endpoint: s.endpoint,
            expirationTime: null,
            keys: { p256dh: s.p256dh, auth: s.auth },
          }
          const message = {
            data: { title: r.title, body: r.body || '', url: '/tempo', tag: r.task_id },
            options: { ttl: 120 as number },
          }
          try {
            const payload = await buildPushPayload(message, subscription, vapid)
            const res = await fetch(s.endpoint, payload)
            // Gone/Not-found → the subscription is dead; prune it.
            if (res.status === 404 || res.status === 410) {
              await sb.rpc('prune_push_subscription', { p_endpoint: s.endpoint })
            }
          } catch {
            // transient — leave the reminder pending isn't possible (we mark below);
            // best-effort delivery, the user still sees it via the in-app fallback.
          }
        }),
      )
      // Mark delivered so it won't fire again (even if the user had no devices).
      await sb.rpc('mark_reminder_delivered', { p_reminder_id: r.reminder_id })
    }),
  )
}

export function scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
  ctx.waitUntil(runReminderScan(env))
}
