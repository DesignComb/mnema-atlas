// Build the web app with a stamped BUILD_VERSION, for the Capacitor APK builtin.
// Used by `npm run cap:sync` so the installed APK knows its own version. The
// stamp is max(now, latest published OTA) so a fresh APK is never older than the
// live OTA bundle (which would wrongly prompt a "downgrade" on first launch).
import { buildWeb, genVersion, latestPublishedVersion } from './_build-web.mjs'

const version = String(Math.max(Number(genVersion()), await latestPublishedVersion()))
buildWeb(version)
console.log(`\n✓ Web build stamped BUILD_VERSION=${version}`)
