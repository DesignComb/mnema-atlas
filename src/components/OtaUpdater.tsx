import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { applyUpdate, checkForUpdate, dismissUpdate, notifyReady, type OtaManifest } from '@/lib/ota'

/**
 * Native-only: marks the running bundle ready (rollback guard), then checks the
 * OTA manifest on launch and on resume. If a newer web bundle is published, it
 * surfaces a persistent toast — tap "更新" to download + swap, "稍後" to skip that
 * version. Renders nothing. No-op on web.
 */
export function OtaUpdater() {
  const t = useT()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    void notifyReady()

    let cancelled = false
    async function promptIfUpdate() {
      const m = await checkForUpdate()
      if (cancelled || !m) return
      toast(t('Update available', '有新版本可更新'), {
        description: m.notes || t('Tap to install the latest version.', '點一下更新到最新版。'),
        duration: Infinity,
        action: { label: t('Update', '更新'), onClick: () => void runUpdate(m, t) },
        cancel: { label: t('Later', '稍後'), onClick: () => void dismissUpdate(m.version) },
      })
    }

    void promptIfUpdate()
    const handle = CapApp.addListener('resume', () => void promptIfUpdate())
    return () => {
      cancelled = true
      handle.then((h) => h.remove()).catch(() => {})
    }
  }, [t])

  return null
}

async function runUpdate(m: OtaManifest, t: (en: string, zh: string) => string) {
  const id = toast.loading(t('Downloading update…', '下載更新中…'))
  try {
    await applyUpdate(m) // set() reloads the webview; code past here may not run
    toast.dismiss(id)
  } catch {
    toast.dismiss(id)
    toast.error(t('Update failed — please try again', '更新失敗，請再試一次'))
  }
}
