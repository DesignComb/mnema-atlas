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

interface DueReview {
  user_id: string
  subscriptions: { endpoint: string; p256dh: string; auth: string }[]
}

/**
 * Daily end-of-day review sweep. For each opted-in user who hasn't journaled
 * today (and hasn't been prompted today): web-push a nudge AND drop a capture
 * (暫存區) so their own AI can ask about today — and again tomorrow if ignored
 * (the catch-up). Idempotent via mark_daily_review_prompted. Push is best-effort
 * and skipped if VAPID is unset; the capture + in-app card still work.
 */
export async function runDailyReviewScan(env: Env): Promise<void> {
  const sb = serviceClient(env)
  const { data, error } = await sb.rpc('due_daily_reviews_for_cron')
  if (error || !Array.isArray(data)) return
  const vapid =
    env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY
      ? { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
      : null

  await Promise.allSettled(
    (data as DueReview[]).map(async (r) => {
      // 1) Push (best-effort).
      if (vapid) {
        await Promise.allSettled(
          r.subscriptions.map(async (s) => {
            const message = {
              data: {
                title: 'Mnema',
                body: '今天過得如何? · How was today?',
                url: '/today?review=1',
                tag: 'daily-review',
              },
              options: { ttl: 3600 as number },
            }
            try {
              const payload = await buildPushPayload(
                message,
                { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } },
                vapid,
              )
              const res = await fetch(s.endpoint, payload)
              if (res.status === 404 || res.status === 410) {
                await sb.rpc('prune_push_subscription', { p_endpoint: s.endpoint })
              }
            } catch {
              /* best-effort */
            }
          }),
        )
      }
      // 2) Capture (暫存區) — the BYO-AI catch-up hook.
      try {
        await sb.rpc('create_capture', {
          p_user_id: r.user_id,
          p_raw_text: '今天過得如何? 回顧一下今天 — 心情、健康、完成的事。(每日回顧 / daily review)',
          p_source: 'rest',
        })
      } catch {
        /* quota or transient — fine */
      }
      // 3) Mark prompted so we don't re-prompt today.
      await sb.rpc('mark_daily_review_prompted', { p_user_id: r.user_id, p_review_date: null })
    }),
  )
}

export function scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
  ctx.waitUntil(runReminderScan(env))
}
