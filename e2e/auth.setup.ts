import { test as setup, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, writeFileSync } from 'node:fs'

/**
 * Logs the dedicated test account in WITHOUT the Google OAuth UI: an admin
 * magic-link (service key) is exchanged for a session (anon key), and the exact
 * localStorage entry supabase-js persists is captured into a Playwright
 * storageState. The authed project reuses it, so the app boots already signed in.
 */
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SECRET_KEY!
const ANON = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!
const EMAIL = process.env.E2E_TEST_EMAIL!
const ORIGIN = 'http://localhost:4173'
const STATE = 'e2e/.auth/state.json'

setup('authenticate', async () => {
  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
  expect(linkErr, linkErr?.message).toBeNull()
  const tokenHash = link.properties?.hashed_token
  expect(tokenHash, 'magic link hashed_token').toBeTruthy()

  // Capture exactly what supabase-js writes to storage (key + serialized session).
  const captured: Record<string, string> = {}
  const storage = {
    getItem: (k: string) => captured[k] ?? null,
    setItem: (k: string, v: string) => {
      captured[k] = v
    },
    removeItem: (k: string) => {
      delete captured[k]
    },
  }
  const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: true, autoRefreshToken: false, storage } })
  const { error: vErr } = await anon.auth.verifyOtp({ token_hash: tokenHash!, type: 'email' })
  expect(vErr, vErr?.message).toBeNull()
  expect(Object.keys(captured).length, 'session persisted to storage').toBeGreaterThan(0)

  mkdirSync('e2e/.auth', { recursive: true })
  writeFileSync(
    STATE,
    JSON.stringify(
      {
        cookies: [],
        origins: [{ origin: ORIGIN, localStorage: Object.entries(captured).map(([name, value]) => ({ name, value })) }],
      },
      null,
      2,
    ),
  )
})
