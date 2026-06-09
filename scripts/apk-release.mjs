// Publish the built debug APK to GitHub Releases so it has a stable download URL:
//   npm run cap:sync && npm run cap:apk        # build the APK first
//   node scripts/apk-release.mjs "what changed natively"
//
// Uploads it as the asset "mnema.apk" on a fresh, marked-latest release, so this
// URL always points at the newest build:
//   https://github.com/DesignComb/mnema-atlas/releases/latest/download/mnema.apk
// Use this for NATIVE changes (widget/plugins/manifest); web-only changes ship
// via `npm run ota:publish` instead. Requires the gh CLI, logged in.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('..', import.meta.url)
const apk = fileURLToPath(new URL('android/app/build/outputs/apk/debug/app-debug.apk', ROOT))
if (!existsSync(apk)) {
  console.error(`No APK found at ${apk}\nBuild it first:  npm run cap:sync && npm run cap:apk`)
  process.exit(1)
}

const notes = process.argv.slice(2).join(' ').trim() || 'Mnema Android debug APK (sideload — enable "install unknown apps").'
const d = new Date()
const p = (n) => String(n).padStart(2, '0')
const tag = `apk-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`

// Upload under a clean asset name (GitHub keeps the on-disk filename otherwise).
const dest = join(tmpdir(), 'mnema.apk')
copyFileSync(apk, dest)
const notesFile = join(tmpdir(), 'mnema-apk-notes.txt')
writeFileSync(notesFile, notes)

console.log(`Creating release ${tag} …`)
execSync(`gh release create ${tag} "${dest}" --latest --title "Mnema Android ${tag}" --notes-file "${notesFile}"`, { stdio: 'inherit' })

console.log(`\n✅ Released ${tag}`)
console.log('   Always-latest: https://github.com/DesignComb/mnema-atlas/releases/latest/download/mnema.apk')
