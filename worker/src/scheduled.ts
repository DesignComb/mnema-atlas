import { buildPushPayload } from '@block65/webcrypto-web-push'
import { serviceClient } from './db'
import { sendFcm } from './fcm'
import type { Env } from './env'

interface DueReminder {
  reminder_id: string
  task_id: string
  title: string
  body: string
  subscriptions: { endpoint: string; p256dh: string; auth: string }[]
  fcm_tokens?: string[]
}

/**
 * Cron entrypoint: find reminders whose time has passed and deliver them via
 * Web Push. Idempotent — due_reminders_for_cron only returns status='pending'
 * rows and we flip them to 'sent', so an at-least-once cron never double-sends.
 */
export async function runReminderScan(env: Env): Promise<void> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT || !env.VAPID_PUBLIC_KEY) return // push not configured yet
  const sb = serviceClient(env)
  // Re-fire reminders for tasks still open ~24h on so an overdue item keeps nudging.
  await sb.rpc('rearm_overdue_reminders')
  const { data, error } = await sb.rpc('due_reminders_for_cron')
  if (error || !Array.isArray(data)) return
  const vapid = {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  }
  const actionUrl = env.WORKER_PUBLIC_URL ? `${env.WORKER_PUBLIC_URL}/_action` : ''

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
            data: {
              title: r.title,
              body: r.body || '',
              url: '/tempo?view=today',
              tag: r.task_id,
              task_id: r.task_id,
              reminder_id: r.reminder_id,
              kind: 'reminder',
              action_url: actionUrl,
              actions: actionUrl
                ? [
                    { action: 'done', title: '已完成' },
                    { action: 'snooze', title: '延後 1 小時' },
                  ]
                : [],
            },
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
      // Native (FCM) push, alongside Web Push — data-only so the app can add buttons.
      await sendFcm(env, r.fcm_tokens ?? [], {
        title: r.title,
        body: r.body || '',
        url: '/tempo?view=today',
        taskId: r.task_id,
        reminderId: r.reminder_id,
        kind: 'reminder',
      })
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

interface DueDigest {
  user_id: string
  count: number
  subscriptions: { endpoint: string; p256dh: string; auth: string }[]
  fcm_tokens?: string[]
}

/**
 * Daily to-do digest. For each opted-in user whose local time has reached their
 * digest_time today (and who hasn't been sent one today), push "你今天有 N 件待辦".
 * Rides the per-minute reminder ping — the finder self-gates on the clock, so it
 * fires once, within a minute of the chosen time. Idempotent via
 * mark_todo_digest_sent (marks even when count=0 so it won't re-check all day).
 */
export async function runTodoDigestScan(env: Env): Promise<void> {
  const sb = serviceClient(env)
  const { data, error } = await sb.rpc('due_todo_digests_for_cron')
  if (error || !Array.isArray(data)) return
  const vapid =
    env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY
      ? { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
      : null

  await Promise.allSettled(
    (data as DueDigest[]).map(async (r) => {
      if (r.count > 0) {
        const body = `你今天有 ${r.count} 件待辦 · ${r.count} task${r.count === 1 ? '' : 's'} today`
        if (vapid) {
          await Promise.allSettled(
            r.subscriptions.map(async (s) => {
              const message = {
                data: { title: '今日待辦 · Today', body, url: '/tempo?view=today', tag: 'todo-digest' },
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
        await sendFcm(env, r.fcm_tokens ?? [], { title: '今日待辦 · Today', body, url: '/tempo?view=today' })
      }
      // Mark sent even when count=0 so we don't re-check (and fire late) all day.
      await sb.rpc('mark_todo_digest_sent', { p_user_id: r.user_id })
    }),
  )
}

interface DueHabit {
  task_id: string
  title: string
  streak: number
  user_id: string
  habit_date: string
  subscriptions: { endpoint: string; p256dh: string; auth: string }[]
  fcm_tokens?: string[]
}

/**
 * Habit deadline reminders. For each habit not checked in whose current day is
 * within 3h of its reset (due_habit_reminders_for_cron), push a Duolingo-style
 * nudge with a 打卡 button. One per habit per habit-day (mark_habit_nudged).
 */
export async function runHabitReminderScan(env: Env): Promise<void> {
  const sb = serviceClient(env)
  const { data, error } = await sb.rpc('due_habit_reminders_for_cron')
  if (error || !Array.isArray(data)) return
  const vapid =
    env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT && env.VAPID_PUBLIC_KEY
      ? { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY }
      : null
  const actionUrl = env.WORKER_PUBLIC_URL ? `${env.WORKER_PUBLIC_URL}/_action` : ''

  await Promise.allSettled(
    (data as DueHabit[]).map(async (h) => {
      const body = h.streak > 0 ? `🔥 別讓 ${h.streak} 天連續紀錄斷掉!「${h.title}」還沒打卡` : `「${h.title}」今天還沒打卡`
      if (vapid) {
        await Promise.allSettled(
          h.subscriptions.map(async (s) => {
            const message = {
              data: {
                title: '打卡提醒 · Check in',
                body,
                url: '/tempo?view=habits',
                tag: 'habit-' + h.task_id,
                task_id: h.task_id,
                kind: 'habit',
                action_url: actionUrl,
                actions: actionUrl ? [{ action: 'checkin', title: '打卡' }] : [],
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
              if (res.status === 404 || res.status === 410) await sb.rpc('prune_push_subscription', { p_endpoint: s.endpoint })
            } catch {
              /* best-effort */
            }
          }),
        )
      }
      await sendFcm(env, h.fcm_tokens ?? [], { title: '打卡提醒 · Check in', body, url: '/tempo?view=habits', taskId: h.task_id, kind: 'habit' })
      await sb.rpc('mark_habit_nudged', { p_user_id: h.user_id, p_task_id: h.task_id, p_habit_date: h.habit_date })
    }),
  )
}

export function scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): void {
  ctx.waitUntil(runReminderScan(env))
  ctx.waitUntil(runTodoDigestScan(env))
  ctx.waitUntil(runHabitReminderScan(env))
}
