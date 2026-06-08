// Publish an OTA web-bundle update (Capgo self-hosted, manual mode):
//   node scripts/ota-publish.mjs "optional release notes"
//
// Builds the web app (stamped with a fresh BUILD_VERSION), zips dist/, sha256s
// the zip, and uploads bundle + manifest.json to a PUBLIC Supabase Storage
// bucket `ota`. The installed app polls manifest.json and offers the update.
// Reads the service key from worker/.dev.vars (gitignored) — never inline.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import AdmZip from 'adm-zip'
import { buildWeb, genVersion, latestPublishedVersion } from './_build-web.mjs'

const ROOT = new URL('..', import.meta.url)
const readEnv = (rel) => {
  try {
    return readFileSync(new URL(rel, ROOT), 'utf8')
  } catch {
    return ''
  }
}
const blob = readEnv('worker/.dev.vars') + '\n' + readEnv('.env.local')
const find = (re) => {
  for (const line of blob.split(/\r?\n/)) {
    const m = re.exec(line.replace(/^\s*#\s*/, '').trim())
    if (m) return m[1].split('#')[0].trim()
  }
  return ''
}

const SUPABASE_URL = find(/SUPABASE_URL\s*=\s*(\S+)/) || find(/VITE_SUPABASE_URL\s*=\s*(\S+)/)
const SERVICE_KEY = find(/SUPABASE_SECRET_KEY\s*=\s*(\S+)/) || find(/(sb_secret_[A-Za-z0-9_-]+)/)
const BUCKET = 'ota'
const notes = process.argv.slice(2).join(' ').trim()

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SECRET_KEY in worker/.dev.vars or .env.local. Aborting.')
  process.exit(1)
}

const authHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

async function ensureBucket() {
  // Public read; cap size + MIME so the bucket can't be abused even if storage
  // RLS is ever loosened (writes still require the service key today).
  const body = JSON.stringify({
    id: BUCKET,
    name: BUCKET,
    public: true,
    file_size_limit: 52428800,
    allowed_mime_types: ['application/zip', 'application/json'],
  })
  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body,
  })
  if (create.ok) {
    console.log(`✓ Created public bucket "${BUCKET}"`)
    return
  }
  const t = await create.text()
  if (!/exist/i.test(t)) {
    console.error(`✗ Could not create bucket (HTTP ${create.status}): ${t.slice(0, 300)}`)
    process.exit(1)
  }
  // Exists — POST won't update it, so force public + caps explicitly (a private
  // bucket would silently break the /object/public/ fetches the app relies on).
  const update = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${BUCKET}`, {
    method: 'PUT',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body,
  })
  if (!update.ok) {
    console.error(`✗ Bucket "${BUCKET}" exists but couldn't be set public (HTTP ${update.status}): ${(await update.text()).slice(0, 300)}`)
    process.exit(1)
  }
  console.log(`✓ Bucket "${BUCKET}" ensured public`)
}

async function upload(path, body, contentType, cacheControl) {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': contentType, 'cache-control': cacheControl, 'x-upsert': 'true' },
    body,
  })
  if (!r.ok) {
    console.error(`✗ Upload ${path} failed (HTTP ${r.status}): ${(await r.text()).slice(0, 300)}`)
    process.exit(1)
  }
  console.log(`✓ Uploaded ${path}`)
}

// ── 1. Build (stamps BUILD_VERSION) ──
// Strictly newer than whatever is already published (handles two publishes in
// the same minute / clock skew).
const version = String(Math.max(Number(genVersion()), (await latestPublishedVersion()) + 1))
console.log(`Building web bundle, BUILD_VERSION=${version} …`)
buildWeb(version)

// ── 2. Zip dist/ contents (index.html must be at the zip root) ──
const zip = new AdmZip()
zip.addLocalFolder(fileURLToPath(new URL('dist', ROOT)))
const buf = zip.toBuffer()
const checksum = createHash('sha256').update(buf).digest('hex')
console.log(`✓ Zipped bundle (${(buf.length / 1024 / 1024).toFixed(2)} MB), sha256=${checksum.slice(0, 12)}…`)

// ── 3. Upload bundle + manifest ──
await ensureBucket()
await upload(`bundle-${version}.zip`, buf, 'application/zip', 'public, max-age=31536000, immutable')

const manifest = {
  version,
  url: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/bundle-${version}.zip`,
  checksum,
  notes: notes || undefined,
}
await upload('manifest.json', JSON.stringify(manifest, null, 2), 'application/json', 'no-cache, max-age=0')

// ── 4. Verify the manifest is publicly reachable ──
const publicManifest = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/manifest.json`
const check = await fetch(`${publicManifest}?_=${Date.now()}`, { cache: 'no-store' })
if (!check.ok) {
  console.error(`\n✗ Bundle uploaded but the manifest is NOT publicly reachable (HTTP ${check.status}). Is the "${BUCKET}" bucket public?`)
  process.exit(1)
}
console.log(`\n✅ Published version ${version}`)
console.log(`   Manifest: ${publicManifest} (HTTP ${check.status})`)
console.log(`   Bundle:   ${manifest.url}`)
if (notes) console.log(`   Notes:    ${notes}`)
