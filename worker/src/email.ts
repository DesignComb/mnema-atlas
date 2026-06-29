import type { Env } from './env'

/**
 * Send one transactional email via the Resend HTTP API. Cloudflare Workers can't
 * use SMTP, so all email goes through a provider's HTTP API. Self-gating: returns
 * false and sends nothing until RESEND_API_KEY + RESEND_FROM are set — mirrors how
 * web-push stays off until VAPID is configured. Best-effort (never throws).
 */
export async function sendEmail(
  env: Env,
  msg: { to: string; subject: string; html: string; text?: string },
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !msg.to) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM,
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
