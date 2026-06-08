// One-off: record the user's recurring Genshin task (塵歌壺, regenerates 72h
// after completion). Uses the sbp_ token + Management API; targets the real
// account by email. Delete after running.
import { readFileSync } from 'node:fs'
const ROOT = new URL('..', import.meta.url)
const env = (r) => { try { return readFileSync(new URL(r, ROOT), 'utf8') } catch { return '' } }
const blob = env('.env.local') + '\n' + env('worker/.dev.vars')
const find = (re) => { for (const l of blob.split(/\r?\n/)) { const m = re.exec(l.replace(/^\s*#\s*/, '').trim()); if (m) return m[1].split('#')[0].trim() } return '' }
const token = find(/(sbp_[A-Za-z0-9]+)/)
const ref = 'enfiuplmzpsmfgrykmxg'
const EMAIL = 'it@capsulecorporation.cc'

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { ok: r.ok, status: r.status, body: j }
}

const u = await sql(`select id from auth.users where email = '${EMAIL}' limit 1`)
const uid = Array.isArray(u.body) && u.body[0]?.id
if (!uid) { console.error('No user for', EMAIL, u.body); process.exit(1) }
console.log('User:', uid)

const res = await sql(`
select id, title, kind, recurrence_rule, recurrence_after_completion, next_occurrence, scheduled_date, labels
from public.create_task(
  p_user_id => '${uid}'::uuid,
  p_title => '原神:塵歌壺',
  p_list_id => null,
  p_parent_task_id => null,
  p_description => '打卡：結束後 72 小時（3 天）會再出現一個新的',
  p_priority => 0,
  p_labels => array['原神']::text[],
  p_scheduled_date => current_date,
  p_scheduled_time => null,
  p_due_date => null,
  p_due_time => null,
  p_duration_min => null,
  p_kind => 'habit',
  p_recurrence_rule => 'FREQ=DAILY;INTERVAL=3',
  p_recurrence_after_completion => true,
  p_recurrence_anchor => current_date,
  p_next_occurrence => current_date,
  p_tz => null,
  p_sort_order => 0,
  p_created_via => 'mcp',
  p_reset_time => null
);
`)
console.log('create_task →', res.status, res.ok ? '✓' : '✗')
console.log(JSON.stringify(res.body, null, 2))
