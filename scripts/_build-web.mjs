// Shared web-build helper. Stamps BUILD_VERSION (YYYYMMDDHHmm) into the bundle
// (vite.config define → __BUILD_VERSION__) so the running app can compare itself
// to the OTA manifest. Used by build-web.mjs (APK builtin) and ota-publish.mjs.
import { execSync } from 'node:child_process'

export function genVersion(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}${p(now.getHours())}${p(now.getMinutes())}`
}

/** Run `vite build` with BUILD_VERSION set and VITE_BASE cleared (native/OTA → base "/"). */
export function buildWeb(version) {
  const env = { ...process.env, BUILD_VERSION: version }
  delete env.VITE_BASE
  execSync('npm run build', { stdio: 'inherit', env })
  return version
}
