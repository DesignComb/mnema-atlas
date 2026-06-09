import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { saveFcmToken } from '@/lib/api'

/**
 * Native push (FCM). The Capacitor WebView can't receive Web Push, so the native
 * app registers with FCM and stores its device token (fcm_tokens); the worker
 * fans reminders/digests out to it alongside Web Push. No-op on web; runs once.
 */
let started = false

export async function startFcm(): Promise<void> {
  if (!Capacitor.isNativePlatform() || started) return
  started = true
  try {
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') {
      started = false
      return
    }
    await PushNotifications.addListener('registration', (token) => {
      void saveFcmToken(token.value).catch(() => {})
    })
    await PushNotifications.addListener('registrationError', () => {
      // leave started=true so we don't loop; user can re-launch to retry
    })
    await PushNotifications.register()
  } catch {
    started = false
  }
}
