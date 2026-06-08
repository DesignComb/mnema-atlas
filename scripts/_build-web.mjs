// Shared web-build helper. Stamps BUILD_VERSION (YYYYMMDDHHmm) into the bundle
// (vite.config define → __BUILD_VERSION__) so the running app can compare itself
// to the OTA manifest. Used by build-web.mjs (APK builtin) and ota-publish.mjs.
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export function genVersion(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`
}

const ROOT = new URL('..', import.meta.url)
function findEnv(re) {
  let blob = ''
  for (const rel of ['worker/.dev.vars', '.env.local']) {
    try {
      blob += readFileSync(new URL(rel, ROOT), 'utf8') + '\n'
    } catch {
      /* ignore */
    }
  }
  for (const line of blob.split(/\r?\n/)) {
    const m = re.exec(line.replace(/^\s*#\s*/, '').trim())
    if (m) return m[1].split('#')[0].trim()
  }
  return ''
}

/**
 * The version currently published to the OTA bucket (0 if none/unreachable).
 * Lets the APK builtin and each new OTA stamp a version that never trails what's
 * already live — so a fresh APK install is never prompted to "update" to an
 * older/identical OTA bundle.
 */
export async function latestPublishedVersion() {
  const url = findEnv(/SUPABASE_URL\s*=\s*(\S+)/) || findEnv(/VITE_SUPABASE_URL\s*=\s*(\S+)/)
  if (!url) return 0
  try {
    const res = await fetch(`${url}/storage/v1/object/public/ota/manifest.json?_=${genVersion()}`, { cache: 'no-store' })
    if (!res.ok) return 0
    const m = await res.json()
    const v = Number(m?.version)
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

/** Run `vite build` with BUILD_VERSION set and VITE_BASE cleared (native/OTA → base "/"). */
export function buildWeb(version) {
  const env = { ...process.env, BUILD_VERSION: String(version) }
  delete env.VITE_BASE
  execSync('npm run build', { stdio: 'inherit', env })
  return String(version)
}
