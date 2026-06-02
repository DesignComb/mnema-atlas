import { RRule } from 'rrule'

// Date-only recurrence math for the AI write path. The DB stores a bare RRULE
// string; we expand it here so BYDAY/INTERVAL advance correctly (the SQL
// fallback in 0014 only understands FREQ+INTERVAL).

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function computeOccurrence(rule: string, fromISO: string, inclusive: boolean): string | null {
  try {
    const [y, m, d] = fromISO.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    const opts = RRule.parseString(rule.replace(/^RRULE:/i, ''))
    const r = new RRule({ ...opts, dtstart: dt })
    const next = r.after(dt, inclusive)
    return next ? toISO(next) : null
  } catch {
    return null // malformed rule → let the SQL fallback handle it
  }
}
