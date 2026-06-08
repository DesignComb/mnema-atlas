// Smoke-test the new RPCs end-to-end against the live DB, as the e2e test user,
// inside a transaction that ROLLS BACK — so it exercises resolve_uid + the
// insert paths without leaving any data behind. Reads creds from the env files.
import { readFileSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url)
const env = (rel) => {
  try {
    return readFileSync(new URL(rel, ROOT), 'utf8')
  } catch {
    return ''
  }
}
const blob = env('.env.local') + '\n' + env('worker/.dev.vars') + '\n' + env('.env.test')
const find = (re) => {
  for (const l of blob.split(/\r?\n/)) {
    const m = re.exec(l.replace(/^\s*#\s*/, '').trim())
    if (m) return m[1].split('#')[0].trim()
  }
  return ''
}
const token = find(/(sbp_[A-Za-z0-9]+)/)
const ref = ((find(/SUPABASE_URL\s*=\s*(\S+)/) || 'https://enfiuplmzpsmfgrykmxg.supabase.co').match(/https:\/\/([a-z0-9]+)\./) || [])[1]
const email = find(/E2E_TEST_EMAIL\s*=\s*(\S+)/) || 'e2e-bot@mnema.test'

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text()
  let j
  try { j = JSON.parse(t) } catch { j = t }
  return { ok: r.ok, status: r.status, body: j }
}

const u = await sql(`select id from auth.users where email = '${email}' limit 1`)
const uid = Array.isArray(u.body) && u.body[0]?.id
if (!uid) {
  console.error('No e2e test user found for', email, '— run scripts/setup-test-user.mjs first.', u.body)
  process.exit(1)
}
console.log('Test user:', uid)

// One transaction: call several new RPCs, read back proof, then ROLLBACK.
const proof = await sql(`
begin;
select public.set_health_settings(p_user_id => '${uid}'::uuid, p_enabled_modules => array['vitals','journal'], p_weight_unit => 'lb');
select public.log_health(p_user_id => '${uid}'::uuid, p_kind => 'weight', p_value => 72.5, p_unit => 'kg');
select public.set_journal_entry(p_user_id => '${uid}'::uuid, p_mood => 4::smallint, p_energy => 3::smallint, p_body => 'smoke');
select public.create_recipe(p_user_id => '${uid}'::uuid, p_title => 'RPC Smoke', p_ingredients => '[{"name":"egg"}]'::jsonb);
select json_build_object(
  'health_logs', (select count(*) from public.health_logs where user_id='${uid}'::uuid),
  'journal_today', (select count(*) from public.journal_entries where user_id='${uid}'::uuid and entry_date=current_date),
  'recipes', (select count(*) from public.recipes where user_id='${uid}'::uuid and title='RPC Smoke'),
  'weight_unit', (select weight_unit from public.health_settings where user_id='${uid}'::uuid)
) as proof;
rollback;
`)

console.log('RPC calls HTTP:', proof.status, proof.ok ? '✓' : '✗')
console.log('Proof (inside the rolled-back txn):', JSON.stringify(proof.body))
// Confirm rollback left nothing behind.
const after = await sql(`select
  (select count(*) from public.health_logs where user_id='${uid}'::uuid) as logs,
  (select count(*) from public.recipes where user_id='${uid}'::uuid and title='RPC Smoke') as recipes`)
console.log('After rollback (should be 0/0):', JSON.stringify(after.body))
console.log(proof.ok ? '\n✅ New RPC write paths execute correctly.' : '\n⚠ See error above.')
