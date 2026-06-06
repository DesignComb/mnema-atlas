// Create (or reset) a dedicated e2e test user and write its creds to .env.test.
// Idempotent. Uses the service key (admin) to create/confirm; verifies password
// sign-in with the publishable/anon key. Run: node scripts/setup-test-user.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function parseEnvFile(path) {
  const out = {}
  if (!existsSync(path)) return out
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(?:#\s*)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !line.trimStart().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const dev = parseEnvFile(new URL('../worker/.dev.vars', import.meta.url))
const local = parseEnvFile(new URL('../.env.local', import.meta.url))
const existing = parseEnvFile(new URL('../.env.test', import.meta.url))

const URL_ = dev.SUPABASE_URL || local.VITE_SUPABASE_URL
const SERVICE = dev.SUPABASE_SECRET_KEY
const ANON = local.VITE_SUPABASE_PUBLISHABLE_KEY
if (!URL_ || !SERVICE || !ANON) throw new Error('missing SUPABASE_URL / SUPABASE_SECRET_KEY / VITE_SUPABASE_PUBLISHABLE_KEY')

const EMAIL = existing.E2E_TEST_EMAIL || 'e2e-bot@mnema.test'
const PASSWORD = existing.E2E_TEST_PASSWORD || randomBytes(18).toString('base64url') + 'A1!'

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

// Find existing user by email (paginate).
let found = null
for (let page = 1; page <= 20 && !found; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  found = data.users.find((u) => u.email === EMAIL) || null
  if (data.users.length < 200) break
}

if (found) {
  const { error } = await admin.auth.admin.updateUserById(found.id, { password: PASSWORD, email_confirm: true })
  if (error) throw error
  console.log('updated existing test user', found.id, EMAIL)
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: 'E2E Bot' },
  })
  if (error) throw error
  console.log('created test user', data.user.id, EMAIL)
}

// Verify password sign-in works through the anon/publishable key (what Playwright will use).
const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } })
const { data: s, error: signErr } = await anon.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
console.log('signInWithPassword:', signErr ? `FAILED — ${signErr.message}` : `OK (access_token len ${s.session?.access_token?.length})`)
if (signErr) process.exitCode = 1

writeFileSync(
  new URL('../.env.test', import.meta.url),
  `# Gitignored. Dedicated e2e test account on the remote Supabase project.\nE2E_TEST_EMAIL=${EMAIL}\nE2E_TEST_PASSWORD=${PASSWORD}\n`,
  'utf8',
)
console.log('wrote .env.test')
