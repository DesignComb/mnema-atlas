import { supabase } from './supabase'

// Public VAPID key. Safe to commit; the matching private key is a worker secret.
// Override at build time with VITE_VAPID_PUBLIC_KEY if you rotate it.
const VAPID_PUBLIC =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  'BJOIOxAJypzGgGZ4v_GsrrRAT2-gGwreLMbhrju_DxZ_2ZmvEunXKHmYuOGUrFI4TVKzY2RLBboN-O0Iy7sbJ38'

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return pushSupported() ? Notification.permission : 'unsupported'
}

export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    return Boolean(await reg.pushManager.getSubscription())
  } catch {
    return false
  }
}

/** Ask permission, subscribe, and store the subscription (via the JWT/RLS RPC). */
export async function enableReminders(): Promise<void> {
  if (!pushSupported()) throw new Error('Push notifications are not supported here')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications were not allowed')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC) as BufferSource,
    }))
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  const { error } = await supabase.rpc('save_push_subscription', {
    p_user_id: null,
    p_endpoint: json.endpoint ?? sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent.slice(0, 300),
  })
  if (error) throw new Error(error.message)
}

export async function disableReminders(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.rpc('delete_push_subscription', { p_user_id: null, p_endpoint: endpoint })
}
