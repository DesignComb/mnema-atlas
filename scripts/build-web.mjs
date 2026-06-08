// Build the web app with a stamped BUILD_VERSION, for the Capacitor APK builtin.
// Used by `npm run cap:sync` so the installed APK knows its own version and can
// tell when an OTA bundle is newer.
import { buildWeb, genVersion } from './_build-web.mjs'

const version = genVersion()
buildWeb(version)
console.log(`\n✓ Web build stamped BUILD_VERSION=${version}`)
