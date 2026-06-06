import { test as teardown } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/** Wipe whatever the authed specs created so the test account stays tidy
 *  (RLS-isolated to the test user; uses the service key to bypass RLS). */
const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SECRET_KEY!
const EMAIL = process.env.E2E_TEST_EMAIL!

teardown('clean up test-account data', async () => {
  const admin = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

  let uid: string | undefined
  for (let page = 1; page <= 20 && !uid; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    uid = data.users.find((u) => u.email === EMAIL)?.id
    if (!data.users.length || data.users.length < 200) break
  }
  if (!uid) return

  // tasks cascade to checkins/reminders; also clear lists + captures.
  await admin.from('tasks').delete().eq('user_id', uid)
  await admin.from('task_lists').delete().eq('user_id', uid)
  await admin.from('captures').delete().eq('user_id', uid)
})
