import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { applyUpdate, checkForUpdate, clearDismiss, dismissUpdate, type OtaManifest } from '@/lib/ota'

// One download at a time; don't re-prompt while one is running.
let updating = false

/**
 * Native-only: checks the OTA manifest on launch and on resume. If a newer web
 * bundle is published, surfaces a single (version-keyed) persistent toast — tap
 * "更新" to download + swap, or dismiss to skip that version. Renders nothing.
 * notifyAppReady() is called at JS entry in main.tsx, not here.
 */
export function OtaUpdater() {
  const t = useT()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false

    async function promptIfUpdate() {
      if (updating) return
      const m = await checkForUpdate()
      if (cancelled || updating || !m) return
      const toastId = `ota-${m.version}`
      toast(t('Update available', '有新版本可更新'), {
        id: toastId, // stable → resume re-checks update this toast instead of stacking
        description: m.notes || t('Tap to install the latest version.', '點一下更新到最新版。'),
        duration: Infinity,
        action: { label: t('Update', '更新'), onClick: () => void runUpdate(m, toastId, t) },
        cancel: { label: t('Later', '稍後'), onClick: () => void dismissUpdate(m.version) },
        onDismiss: () => void dismissUpdate(m.version), // swipe-away also skips this version
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

async function runUpdate(m: OtaManifest, toastId: string, t: (en: string, zh: string) => string) {
  if (updating) return
  updating = true
  toast.loading(t('Downloading update…', '下載更新中…'), { id: toastId })

  let progress: { remove: () => void } | undefined
  try {
    progress = await CapacitorUpdater.addListener('download', (e) => {
      const pct = Math.max(0, Math.min(100, Math.round(e.percent ?? 0)))
      toast.loading(t(`Downloading update… ${pct}%`, `下載更新中… ${pct}%`), { id: toastId })
    })
    await applyUpdate(m) // set() reloads the webview; code past here may not run
    toast.dismiss(toastId)
  } catch (err) {
    // A failed attempt shouldn't suppress the prompt — let the next check re-offer.
    void clearDismiss(m.version)
    console.error('[mnema] OTA update failed', m.version, m.url, err)
    toast.error(t('Update failed — please try again', '更新失敗，請再試一次'), { id: toastId, duration: 5000 })
  } finally {
    progress?.remove()
    updating = false
  }
}
