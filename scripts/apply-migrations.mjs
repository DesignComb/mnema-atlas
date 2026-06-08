// Apply pending SQL migrations to the remote Supabase project via the Management
// API, then verify the new tables/functions exist. Reads the personal access
// token (sbp_…) from the env files so the secret never touches the command line.
//
//   node scripts/apply-migrations.mjs 0027 0028 0029 0030 0031
//   node scripts/apply-migrations.mjs            # applies every supabase/migrations/*.sql arg-less is not allowed; pass numbers
//
// Idempotent: the migrations use `create table if not exists` / `create or
// replace function`, so re-running is safe.
import { readFileSync, readdirSync } from 'node:fs'

const ROOT = new URL('..', import.meta.url)
function readEnv(rel) {
  try {
    return readFileSync(new URL(rel, ROOT), 'utf8')
  } catch {
    return ''
  }
}

// Collect candidate values from .env.local + worker/.dev.vars, INCLUDING
// commented-out lines (a token may be parked behind a `#`).
const blob = readEnv('.env.local') + '\n' + readEnv('worker/.dev.vars')
function findValue(re) {
  for (const line of blob.split(/\r?\n/)) {
    const m = re.exec(line.replace(/^\s*#\s*/, '').trim())
    if (m) return m[1].split('#')[0].trim()
  }
  return ''
}
const token = findValue(/(?:^|\b)(sbp_[A-Za-z0-9]+)/) // any sbp_ personal access token
const url = findValue(/SUPABASE_URL\s*=\s*(\S+)/) || 'https://enfiuplmzpsmfgrykmxg.supabase.co'
const ref = (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1]

if (!token) {
  console.error('No sbp_ personal access token found in .env.local / worker/.dev.vars. Aborting.')
  process.exit(1)
}
if (!ref) {
  console.error('Could not derive project ref from SUPABASE_URL. Aborting.')
  process.exit(1)
}
console.log(`Project ref: ${ref}  ·  token: sbp_…${token.slice(-4)} (len ${token.length})`)

async function runSql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await r.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { ok: r.ok, status: r.status, body: json }
}

const nums = process.argv.slice(2)
if (!nums.length) {
  console.error('Pass migration number prefixes, e.g.: node scripts/apply-migrations.mjs 0027 0028 0029 0030 0031')
  process.exit(1)
}
const dir = new URL('supabase/migrations/', ROOT)
const files = readdirSync(dir).filter((f) => f.endsWith('.sql'))

for (const n of nums) {
  const file = files.find((f) => f.startsWith(n + '_') || f.startsWith(n))
  if (!file) {
    console.error(`  ✗ no migration file for "${n}"`)
    process.exit(1)
  }
  const sql = readFileSync(new URL(file, dir), 'utf8')
  process.stdout.write(`Applying ${file} … `)
  const res = await runSql(sql)
  if (!res.ok) {
    console.log(`HTTP ${res.status}`)
    console.error('  ✗ FAILED:', typeof res.body === 'string' ? res.body.slice(0, 600) : JSON.stringify(res.body).slice(0, 600))
    process.exit(1)
  }
  console.log(`HTTP ${res.status} ✓`)
}

// ── Verify: the new tables + a sample of the new functions exist ──
console.log('\nVerifying schema objects…')
const verify = await runSql(`
  select 'table' as kind, table_name as name from information_schema.tables
    where table_schema='public' and table_name in
      ('health_settings','health_logs','journal_entries','medications',
       'recipes','pantry_items','shopping_items','meal_plans',
       'subscriptions','review_prefs','daily_reviews')
  union all
  select 'function', routine_name from information_schema.routines
    where routine_schema='public' and routine_name in
      ('log_health','set_journal_entry','create_medication','set_health_settings',
       'create_recipe','add_shopping_items','set_meal_plan',
       'set_subscription','post_due_subscriptions','set_task_url',
       'set_review_prefs','mark_daily_review_prompted','due_daily_reviews_for_cron')
  order by kind, name;
`)
if (!verify.ok) {
  console.error('  verify query failed:', verify.status, verify.body)
  process.exit(1)
}
const rows = Array.isArray(verify.body) ? verify.body : []
const tables = rows.filter((r) => r.kind === 'table').map((r) => r.name)
const fns = rows.filter((r) => r.kind === 'function').map((r) => r.name)
console.log(`  tables (${tables.length}/11): ${tables.join(', ')}`)
console.log(`  functions (${fns.length}/13): ${fns.join(', ')}`)
console.log(tables.length === 11 && fns.length === 13 ? '\n✅ All new objects present.' : '\n⚠ Some objects missing — check above.')
