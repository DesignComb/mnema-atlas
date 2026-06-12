// Publish a new Android build with a stable download URL + in-app update manifest:
//   node scripts/apk-release.mjs "what changed natively"
//
// Does the whole native release in one go:
//   1. bumps versionCode (+1) / versionName ("1.<code>") in android/app/build.gradle
//      — Android only installs an update when versionCode increases, and the
//      in-app updater compares against it
//   2. runs cap sync + gradle assembleDebug (JAVA_HOME defaults to Android
//      Studio's bundled JBR when unset)
//   3. uploads the APK as the asset "mnema.apk" on a fresh, marked-latest
//      GitHub release, so this URL always points at the newest build:
//        https://github.com/DesignComb/mnema-atlas/releases/latest/download/mnema.apk
//   4. uploads apk-manifest.json next to the OTA manifest (public `ota` bucket)
//      so installed apps (>= versionCode 2) can offer the update IN-APP via
//      ApkInstaller (DownloadManager → package-installer sheet)
//
// Use this for NATIVE changes (widgets/plugins/manifest); web-only changes ship
// via `npm run ota:publish` instead. Requires the gh CLI, logged in.
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('..', import.meta.url)
const rootDir = fileURLToPath(ROOT)
// --dry-run: bump + build only, skip the GitHub release + manifest upload.
const args = process.argv.slice(2).filter((a) => a !== '--dry-run')
const dryRun = process.argv.includes('--dry-run')
const notes = args.join(' ').trim() || 'Mnema Android debug APK (sideload — enable "install unknown apps").'

// ── 1. Bump versionCode / versionName ──
const gradlePath = fileURLToPath(new URL('android/app/build.gradle', ROOT))
let gradle = readFileSync(gradlePath, 'utf8')
const codeMatch = gradle.match(/versionCode\s+(\d+)/)
if (!codeMatch) {
  console.error('Could not find versionCode in android/app/build.gradle. Aborting.')
  process.exit(1)
}
const newCode = Number(codeMatch[1]) + 1
const newName = `1.${newCode}`
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${newCode}`)
gradle = gradle.replace(/versionName\s+"[^"]*"/, `versionName "${newName}"`)
writeFileSync(gradlePath, gradle)
console.log(`✓ Bumped to versionCode ${newCode} (versionName ${newName})`)

// ── 2. Build (fresh web bundle baked in) ──
if (!process.env.JAVA_HOME) {
  const jbr = 'C:\\Program Files\\Android\\Android Studio\\jbr'
  if (existsSync(jbr)) process.env.JAVA_HOME = jbr
}
console.log('Building web bundle + syncing into android/ …')
execSync('npm run cap:sync', { stdio: 'inherit', cwd: rootDir })
console.log('Building APK …')
// Explicit .\ path: NoDefaultCurrentDirectoryInExePath keeps cmd from resolving
// bare names in the cwd.
execSync('.\\gradlew.bat assembleDebug', { stdio: 'inherit', cwd: join(rootDir, 'android') })

const apk = fileURLToPath(new URL('android/app/build/outputs/apk/debug/app-debug.apk', ROOT))
if (!existsSync(apk)) {
  console.error(`No APK found at ${apk} after the build. Aborting.`)
  process.exit(1)
}

if (dryRun) {
  console.log(`\n✅ Dry run OK — APK built at ${apk} (versionCode ${newCode}). Nothing published.`)
  process.exit(0)
}

// ── 3. GitHub release ──
const d = new Date()
const p = (n) => String(n).padStart(2, '0')
const tag = `apk-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`

// Upload under a clean asset name (GitHub keeps the on-disk filename otherwise).
const dest = join(tmpdir(), 'mnema.apk')
copyFileSync(apk, dest)
const notesFile = join(tmpdir(), 'mnema-apk-notes.txt')
writeFileSync(notesFile, notes)

console.log(`Creating release ${tag} …`)
execSync(`gh release create ${tag} "${dest}" --latest --title "Mnema Android ${tag} (v${newName})" --notes-file "${notesFile}"`, {
  stdio: 'inherit',
  cwd: rootDir,
})

// ── 4. In-app update manifest (same public bucket as the web OTA) ──
const env = (() => {
  const read = (rel) => {
    try {
      return readFileSync(new URL(rel, ROOT), 'utf8')
    } catch {
      return ''
    }
  }
  return read('worker/.dev.vars') + '\n' + read('.env.local')
})()
const find = (re) => {
  for (const line of env.split(/\r?\n/)) {
    const m = re.exec(line.replace(/^\s*#\s*/, '').trim())
    if (m) return m[1].split('#')[0].trim()
  }
  return ''
}
const SUPABASE_URL = find(/SUPABASE_URL\s*=\s*(\S+)/) || find(/VITE_SUPABASE_URL\s*=\s*(\S+)/)
const SERVICE_KEY = find(/SUPABASE_SECRET_KEY\s*=\s*(\S+)/) || find(/(sb_secret_[A-Za-z0-9_-]+)/)
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('⚠ Released on GitHub, but no SUPABASE_URL / secret key found — apk-manifest.json NOT updated (in-app prompt will not fire).')
  process.exit(1)
}
const manifest = {
  versionCode: newCode,
  versionName: newName,
  url: 'https://github.com/DesignComb/mnema-atlas/releases/latest/download/mnema.apk',
  notes: notes || undefined,
  tag,
}
const up = await fetch(`${SUPABASE_URL}/storage/v1/object/ota/apk-manifest.json`, {
  method: 'POST',
  headers: {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'cache-control': 'no-cache, max-age=0',
    'x-upsert': 'true',
  },
  body: JSON.stringify(manifest, null, 2),
})
if (!up.ok) {
  console.error(`✗ apk-manifest.json upload failed (HTTP ${up.status}): ${(await up.text()).slice(0, 300)}`)
  process.exit(1)
}
console.log('✓ Uploaded apk-manifest.json (in-app update prompt is live)')

console.log(`\n✅ Released ${tag} — versionCode ${newCode}`)
console.log('   Always-latest: https://github.com/DesignComb/mnema-atlas/releases/latest/download/mnema.apk')
console.log('   Remember to commit the build.gradle version bump.')
