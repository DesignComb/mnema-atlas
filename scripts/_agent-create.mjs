// Act as an EXTERNAL AI agent (the product's BYO-AI path): provision an API key
// for the user's real account, then create a habit by calling the DEPLOYED
// worker's public REST endpoint — exactly what a third-party agent would do.
// Doubles as an end-to-end test of the freshly deployed worker + new tools.
import { readFileSync } from 'node:fs'
const ROOT = new URL('..', import.meta.url)
const env = (r) => { try { return readFileSync(new URL(r, ROOT), 'utf8') } catch { return '' } }
const blob = env('.env.local') + '\n' + env('worker/.dev.vars')
const find = (re) => { for (const l of blob.split(/\r?\n/)) { const m = re.exec(l.replace(/^\s*#\s*/, '').trim()); if (m) return m[1].split('#')[0].trim() } return '' }
const token = find(/(sbp_[A-Za-z0-9]+)/)            // sbp_ = Management API (provision only)
const ref = 'enfiuplmzpsmfgrykmxg'
const WORKER = 'https://mnema-ai.dco.tw'            // deployed worker (from wrangler deploy)
const EMAIL = 'eric990262@gmail.com'               // user's real personal account (user-specified)

async function mgmt(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { ok: r.ok, status: r.status, body: j }
}

// 1) Resolve the real account.
const u = await mgmt(`select id from auth.users where email = '${EMAIL}' limit 1`)
const uid = Array.isArray(u.body) && u.body[0]?.id
if (!uid) { console.error('No account for', EMAIL, u.body); process.exit(1) }
console.log('Account:', EMAIL, uid)

// 2) Provision an API key (create + edit scope) for that account.
const k = await mgmt(`select api_key, key_prefix from public.create_api_key(p_user_id => '${uid}'::uuid, p_name => 'agent-test (Claude)', p_scopes => array['create','edit'])`)
const apiKey = Array.isArray(k.body) && k.body[0]?.api_key
if (!apiKey) { console.error('create_api_key failed:', k.status, k.body); process.exit(1) }
console.log('Provisioned key:', (k.body[0].key_prefix || '') + '…')

// 3) Act as the external agent: call the DEPLOYED worker's public REST endpoint.
const today = new Date()
const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const res = await fetch(`${WORKER}/rest/create_task`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: '原神:塵歌壺',
    kind: 'habit',
    labels: ['原神'],
    scheduled_date: todayISO,
    recurrence_rule: 'FREQ=DAILY;INTERVAL=3',     // 72h
    recurrence_after_completion: true,            // regenerates 72h AFTER you complete it
  }),
})
const out = await res.text(); let outJ; try { outJ = JSON.parse(out) } catch { outJ = out }
console.log('\nPOST', WORKER + '/rest/create_task →', res.status)
console.log(JSON.stringify(outJ, null, 2))

// 4) Read it back from the DB to confirm what actually got stored.
const taskId = outJ?.data?.id
if (taskId) {
  const v = await mgmt(`select title, kind, recurrence_rule, recurrence_after_completion, next_occurrence, scheduled_date, labels, created_via from public.tasks where id = '${taskId}'`)
  console.log('\nStored row:', JSON.stringify(v.body))
}
console.log(res.ok ? '\n✅ Habit created via the real external-agent (REST) path.' : '\n⚠ See response above.')
