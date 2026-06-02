/**
 * Recurrence helpers. `rrule` is dynamically imported so it only loads inside the
 * (code-split) Tempo route, never in the initial bundle. The DB stores a plain
 * RFC-5545 RRULE string (no DTSTART); occurrences are computed here in JS.
 */

export type Freq = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

/** Build a bare RRULE string from picker state (no DTSTART). */
export function buildRRule(freq: Freq, interval: number, byday: string[]): string {
  const parts = [`FREQ=${freq}`]
  if (interval > 1) parts.push(`INTERVAL=${interval}`)
  if (freq === 'WEEKLY' && byday.length) parts.push(`BYDAY=${byday.join(',')}`)
  return parts.join(';')
}

/** Parse a stored rule back into picker state (best-effort, for editing). */
export function parseRRule(rule: string | null): { freq: Freq | 'none'; interval: number; byday: string[] } {
  if (!rule) return { freq: 'none', interval: 1, byday: [] }
  const up = rule.toUpperCase()
  const freq = (/FREQ=(\w+)/.exec(up)?.[1] as Freq) ?? 'none'
  const interval = Number(/INTERVAL=(\d+)/.exec(up)?.[1] ?? '1')
  const byday = (/BYDAY=([A-Z,]+)/.exec(up)?.[1] ?? '').split(',').filter(Boolean)
  return { freq: (['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as string[]).includes(freq) ? freq : 'none', interval, byday }
}

/** A short, localised label for a rule (sync; no rrule needed). */
export function shortRecurrenceLabel(rule: string | null, t: (en: string, zh: string) => string): string | null {
  if (!rule) return null
  const up = rule.toUpperCase()
  const freq = /FREQ=(\w+)/.exec(up)?.[1]
  const interval = Number(/INTERVAL=(\d+)/.exec(up)?.[1] ?? '1')
  if (freq === 'DAILY') return interval > 1 ? t(`Every ${interval} days`, `每 ${interval} 天`) : t('Daily', '每天')
  if (freq === 'WEEKLY') return interval > 1 ? t(`Every ${interval} weeks`, `每 ${interval} 週`) : t('Weekly', '每週')
  if (freq === 'MONTHLY') return interval > 1 ? t(`Every ${interval} months`, `每 ${interval} 個月`) : t('Monthly', '每月')
  if (freq === 'YEARLY') return t('Yearly', '每年')
  return t('Repeats', '重複')
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * The next occurrence of `rule` relative to `fromISO`.
 *  - inclusive=true  → the first occurrence on/after fromISO (use when seeding next_occurrence).
 *  - inclusive=false → the first occurrence strictly after fromISO (use when advancing on complete).
 */
export async function computeOccurrence(rule: string, fromISO: string, inclusive: boolean): Promise<string | null> {
  const { RRule } = await import('rrule')
  const [y, m, d] = fromISO.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  const opts = RRule.parseString(rule.replace(/^RRULE:/i, ''))
  const r = new RRule({ ...opts, dtstart: dt })
  const next = r.after(dt, inclusive)
  return next ? toISO(next) : null
}
