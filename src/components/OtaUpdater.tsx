import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { applyUpdate, checkForUpdate, clearDismiss, dismissUpdate, type OtaManifest } from '@/lib/ota'
import { checkForApkUpdate, clearApkDismiss, dismissApkUpdate, installApk, type ApkManifest } from '@/lib/apk-update'

// One download at a time; don't re-prompt while one is running.
let updating = false

/**
 * Native-only: checks the OTA manifest on launch and on resume. If a newer web
 * bundle is published, surfaces a single (version-keyed) persistent toast — tap
 * "更新" to download + swap, or dismiss to skip that version. Renders nothing.
 * notifyAppReady() is called at JS entry in main.tsx, not here.
 *
 * A NATIVE update (new APK) takes priority over a web OTA: the APK already
 * carries the newest web bundle, so when both exist only the APK is offered.
 */
export function OtaUpdater() {
  const t = useT()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false

    async function promptIfUpdate() {
      if (updating) return
      const apk = await checkForApkUpdate()
      if (cancelled || updating) return
      if (apk) {
        const toastId = `apk-${apk.versionCode}`
        toast(t('App update available', '有新版 APP 可更新'), {
          id: toastId,
          description: apk.notes || t('Includes native features (e.g. widgets).', '包含原生功能(例如小工具)。'),
          duration: Infinity,
          action: { label: t('Update', '更新'), onClick: () => void runApkUpdate(apk, toastId, t) },
          cancel: { label: t('Later', '稍後'), onClick: () => void dismissApkUpdate(apk.versionCode) },
          onDismiss: () => void dismissApkUpdate(apk.versionCode),
        })
        return // the APK bundles the latest web build — don't also offer the OTA
      }
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

async function runApkUpdate(m: ApkManifest, toastId: string, t: (en: string, zh: string) => string) {
  try {
    await installApk(m)
    toast.success(
      t('Downloading — the install screen will open when it finishes.', '下載中 — 完成後會自動跳出安裝畫面。'),
      { id: toastId, duration: 8000 },
    )
  } catch (err) {
    void clearApkDismiss(m.versionCode)
    console.error('[mnema] APK update failed', m.versionCode, m.url, err)
    toast.error(t('Update failed — please try again', '更新失敗，請再試一次'), { id: toastId, duration: 5000 })
  }
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
