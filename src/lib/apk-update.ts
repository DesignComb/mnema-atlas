import { Capacitor, registerPlugin } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Preferences } from '@capacitor/preferences'

/**
 * In-app NATIVE update channel, the sibling of ota.ts: web-layer changes ship
 * via the Capgo bundle, but native changes (widgets, plugins, manifest) need a
 * new APK. scripts/apk-release.mjs publishes `apk-manifest.json` next to the OTA
 * manifest; here we compare its versionCode to the installed build and, on tap,
 * hand the stable download URL to the ApkInstaller plugin (DownloadManager →
 * package-installer sheet). Signature matches, so it updates in place.
 */
const ApkInstaller = registerPlugin<{ install(options: { url: string }): Promise<void> }>('ApkInstaller')

const MANIFEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/ota/apk-manifest.json`
const DISMISS_KEY = 'apk:dismissed'

export interface ApkManifest {
  versionCode: number
  versionName: string
  url: string
  notes?: string
}

async function fetchApkManifest(): Promise<ApkManifest | null> {
  try {
    const res = await fetch(`${MANIFEST_URL}?_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const m = (await res.json()) as Partial<ApkManifest>
    if (typeof m.versionCode === 'number' && typeof m.url === 'string' && typeof m.versionName === 'string') {
      return { versionCode: m.versionCode, versionName: m.versionName, url: m.url, notes: typeof m.notes === 'string' ? m.notes : undefined }
    }
    return null
  } catch {
    return null
  }
}

/** Returns a manifest only if its versionCode beats the installed build and isn't dismissed. */
export async function checkForApkUpdate(): Promise<ApkManifest | null> {
  if (!Capacitor.isNativePlatform()) return null
  const m = await fetchApkManifest()
  if (!m) return null
  let installed = 0
  try {
    installed = Number((await CapApp.getInfo()).build)
  } catch {
    return null
  }
  if (!Number.isFinite(installed) || installed <= 0) return null
  if (m.versionCode <= installed) return null
  const dismissed = (await Preferences.get({ key: DISMISS_KEY })).value
  if (dismissed === String(m.versionCode)) return null
  return m
}

export async function dismissApkUpdate(versionCode: number): Promise<void> {
  try {
    await Preferences.set({ key: DISMISS_KEY, value: String(versionCode) })
  } catch {
    // ignore
  }
}

export async function clearApkDismiss(versionCode: number): Promise<void> {
  try {
    const cur = (await Preferences.get({ key: DISMISS_KEY })).value
    if (cur === String(versionCode)) await Preferences.remove({ key: DISMISS_KEY })
  } catch {
    // ignore
  }
}

/** Kick off download + installer sheet (resolves when the download is queued). */
export async function installApk(m: ApkManifest): Promise<void> {
  if (Capacitor.isPluginAvailable('ApkInstaller')) {
    await ApkInstaller.install({ url: m.url })
    return
  }
  // Legacy APKs (≤ versionCode 1) predate the plugin but still receive this web
  // code via OTA — hand the download to the browser instead of failing.
  const { Browser } = await import('@capacitor/browser')
  await Browser.open({ url: m.url })
}
