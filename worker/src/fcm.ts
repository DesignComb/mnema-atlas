import { serviceClient } from './db'
import type { Env } from './env'

/**
 * FCM HTTP v1 sender. Web Push can't reach the native (WebView) app, so reminders
 * and digests also fan out to FCM device tokens. We sign a JWT with the service
 * account (Web Crypto RS256), exchange it for an OAuth access token (cached per
 * isolate), then POST messages:send per token, pruning UNREGISTERED tokens.
 */
interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlStr(str: string): string {
  return b64url(new TextEncoder().encode(str))
}
function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const bin = atob(body)
  const der = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) der[i] = bin.charCodeAt(i)
  return der
}

let cachedToken: { value: string; exp: number } | null = null

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedToken && cachedToken.exp > now + 60) return cachedToken.value

  const header = b64urlStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64urlStr(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const unsigned = `${header}.${claim}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(new Uint8Array(sig))}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })
  const j = (await res.json()) as { access_token?: string }
  if (!j.access_token) throw new Error('fcm token exchange failed')
  cachedToken = { value: j.access_token, exp: now + 3500 }
  return j.access_token
}

export async function sendFcm(
  env: Env,
  tokens: string[],
  msg: { title: string; body: string; url?: string; taskId?: string; reminderId?: string; kind?: string },
): Promise<void> {
  if (!env.FCM_SERVICE_ACCOUNT || !tokens || tokens.length === 0) return
  let sa: ServiceAccount
  try {
    sa = JSON.parse(env.FCM_SERVICE_ACCOUNT)
  } catch {
    return
  }
  let token: string
  try {
    token = await accessToken(sa)
  } catch {
    return
  }
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  const sb = serviceClient(env)

  // Data-only (no `notification` key) so the native MnemaMessagingService renders
  // it and can add the 延後/已完成 action buttons. All data values must be strings.
  const data: Record<string, string> = { title: msg.title, body: msg.body || '' }
  if (msg.url) data.url = msg.url
  if (msg.taskId) data.task_id = msg.taskId
  if (msg.reminderId) data.reminder_id = msg.reminderId
  if (msg.kind) data.kind = msg.kind

  await Promise.allSettled(
    tokens.map(async (t) => {
      const body = {
        message: {
          token: t,
          data,
          android: { priority: 'HIGH' },
        },
      }
      try {
        const r = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!r.ok) {
          const txt = await r.text().catch(() => '')
          if (/UNREGISTERED|registration-token-not-registered|invalid.?registration/i.test(txt)) {
            await sb.rpc('prune_fcm_token', { p_token: t })
          }
        }
      } catch {
        /* best-effort */
      }
    }),
  )
}
