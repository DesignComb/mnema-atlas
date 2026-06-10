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
 * Which calendar day a habit check-in counts for, given its reset cutoff.
 *
 * A habit's "day" can roll over at `resetTime` (wall-clock, in `tz`) instead of
 * midnight — Genshin dailies reset at 04:00, so before 04:00 you are still in
 * the previous habit-day. We read the current wall-clock time in `tz`, and if it
 * is before the cutoff we step back one day:  habit-day = date(now-in-tz − reset).
 *
 * resetTime null/"00:00" → ordinary calendar day. tz null → the browser's zone.
 */
export function habitTodayISO(resetTime: string | null, tz: string | null, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    // Null tz → UTC, to MATCH the server (app.habit_today coalesces null→UTC).
    // Habits created in-app always carry a tz; this only affects AI/legacy ones.
    timeZone: tz || 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  let y = pick('year')
  let mo = pick('month')
  let d = pick('day')
  const nowMin = (pick('hour') % 24) * 60 + pick('minute')

  const [rh, rm] = (resetTime ?? '').split(':').map(Number)
  const resetMin = (rh || 0) * 60 + (rm || 0)

  // Before today's cutoff → the day hasn't rolled over; still the previous one.
  if (nowMin < resetMin) {
    const prev = new Date(Date.UTC(y, mo - 1, d - 1))
    y = prev.getUTCFullYear()
    mo = prev.getUTCMonth() + 1
    d = prev.getUTCDate()
  }
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** "HH:MM" of a habit's reset cutoff for display, or null when unset/malformed. */
export function formatResetTime(resetTime: string | null): string | null {
  const m = resetTime ? /^(\d{2}:\d{2})/.exec(resetTime) : null
  return m ? m[1] : null
}

/**
 * Minutes from now until the current habit-day ENDS (the next reset boundary) —
 * i.e. the deadline to check in. reset null/00:00 → next midnight in tz. Mirrors
 * the server's due_habit_reminders_for_cron window math.
 */
export function minutesUntilReset(resetTime: string | null, tz: string | null, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || 'UTC', // match the server (app.next_reset_at coalesces null→UTC)
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  const nowMin = (pick('hour') % 24) * 60 + pick('minute')
  const [rh, rm] = (resetTime ?? '').split(':').map(Number)
  const resetMin = (rh || 0) * 60 + (rm || 0)
  if (resetMin === 0) return 24 * 60 - nowMin || 24 * 60 // next midnight (24h if exactly midnight)
  if (nowMin < resetMin) return resetMin - nowMin
  return 24 * 60 - nowMin + resetMin
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
