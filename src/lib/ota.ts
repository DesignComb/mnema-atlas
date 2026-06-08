import { Capacitor } from '@capacitor/core'
import { CapacitorUpdater } from '@capgo/capacitor-updater'
import { Preferences } from '@capacitor/preferences'

/**
 * Self-hosted OTA (Capgo manual mode). The web layer is just bundled assets, so
 * most updates (UI, features, fixes) ship as a new web bundle without a new APK.
 * scripts/ota-publish.mjs builds, zips, and uploads the bundle + a manifest to a
 * public Supabase Storage bucket; here we fetch that manifest, compare it to the
 * running build, and — on the user's tap — download + swap. Native code changes
 * still need a fresh APK (the manifest version won't help there). No-ops on web.
 */
const MANIFEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/ota/manifest.json`
const DISMISS_KEY = 'ota:dismissed'

export interface OtaManifest {
  version: string
  url: string
  checksum: string
  notes?: string
}

/** The web build currently running (baked in at build time as YYYYMMDDHHmm). */
export function runningVersion(): number {
  const n = Number(__BUILD_VERSION__)
  return Number.isFinite(n) ? n : 0
}

/** Mark the loaded bundle good so Capgo doesn't auto-roll-back. Call once on boot. */
export async function notifyReady(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await CapacitorUpdater.notifyAppReady()
  } catch {
    // Plugin missing in some shells — non-fatal.
  }
}

async function fetchManifest(): Promise<OtaManifest | null> {
  try {
    // Cache-bust so a freshly published manifest is seen immediately.
    const res = await fetch(`${MANIFEST_URL}?_=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const m = (await res.json()) as Partial<OtaManifest>
    if (typeof m.version === 'string' && typeof m.url === 'string' && typeof m.checksum === 'string') {
      return { version: m.version, url: m.url, checksum: m.checksum, notes: typeof m.notes === 'string' ? m.notes : undefined }
    }
    return null
  } catch {
    return null
  }
}

/** Returns a manifest only if it's strictly newer than what's running and not dismissed. */
export async function checkForUpdate(): Promise<OtaManifest | null> {
  if (!Capacitor.isNativePlatform()) return null
  const running = runningVersion()
  if (!running) return null // dev build — never prompt
  const m = await fetchManifest()
  if (!m) return null
  const target = Number(m.version)
  if (!Number.isFinite(target) || target <= running) return null
  const dismissed = (await Preferences.get({ key: DISMISS_KEY })).value
  if (dismissed === m.version) return null
  return m
}

export async function dismissUpdate(version: string): Promise<void> {
  try {
    await Preferences.set({ key: DISMISS_KEY, value: version })
  } catch {
    // ignore
  }
}

/** Download + activate the bundle. set() reloads the webview into the new bundle. */
export async function applyUpdate(m: OtaManifest): Promise<void> {
  const bundle = await CapacitorUpdater.download({ version: m.version, url: m.url, checksum: m.checksum })
  await CapacitorUpdater.set({ id: bundle.id })
}
