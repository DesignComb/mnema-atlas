/** Zero-dependency date helpers for the Tempo calendar. All dates are 'YYYY-MM-DD'
 *  strings handled in UTC so day arithmetic never drifts across timezones/DST. */

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}
export function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return ymd(d)
}
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: string): number {
  return parseISO(iso).getUTCDay()
}
/** Sunday-based start of the week containing `iso` (week starts on Sunday). */
export function startOfWeek(iso: string): string {
  return addDays(iso, -weekday(iso))
}
export function weekDays(iso: string): string[] {
  const s = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}
/** A 6×7 grid of day strings covering `month0` (0–11), Monday-aligned. */
export function monthGrid(year: number, month0: number): string[] {
  const first = `${year}-${pad(month0 + 1)}-01`
  const gridStart = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
}
export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7)) - 1
}
export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4))
}
export function dayNum(iso: string): number {
  return Number(iso.slice(8, 10))
}
/** Days from `today` to `iso` (negative = past). Pure string math, UTC-safe. */
export function dayDiff(iso: string, today: string): number {
  return Math.round((parseISO(iso).getTime() - parseISO(today).getTime()) / 86_400_000)
}

const WD_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WD_ZH_SHORT = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Bilingual absolute day label: "Jun 14 (Sat)" / "6月14日(週六)"; adds the year when it differs (QW7). */
export function fmtDayDate(iso: string, lang: 'en' | 'zh', today: string = todayISO()): string {
  const y = yearOf(iso)
  const m = monthOf(iso)
  const d = dayNum(iso)
  const wd = weekday(iso)
  const sameYear = y === yearOf(today)
  if (lang === 'zh') return `${sameYear ? '' : `${y}年`}${m + 1}月${d}日(${WD_ZH_SHORT[wd]})`
  return `${MON_EN[m]} ${d}${sameYear ? '' : `, ${y}`} (${WD_EN_SHORT[wd]})`
}

/**
 * Bilingual relative day label (QW7): Today/Tomorrow/Yesterday, a weekday for
 * the coming week, otherwise a short date. Overdue ≥2 days appends "· Nd late".
 * Pass `time` ('HH:MM[:SS]') so it lands with the date, BEFORE any suffix.
 */
export function relativeDayLabel(iso: string, today: string, lang: 'en' | 'zh', time?: string | null): string {
  const tt = time ? ` ${time.slice(0, 5)}` : ''
  const diff = dayDiff(iso, today)
  if (diff === 0) return (lang === 'zh' ? '今天' : 'Today') + tt
  if (diff === 1) return (lang === 'zh' ? '明天' : 'Tomorrow') + tt
  if (diff === -1) return (lang === 'zh' ? '昨天' : 'Yesterday') + tt
  if (diff > 1 && diff <= 6) return (lang === 'zh' ? WD_ZH_SHORT[weekday(iso)] : WD_EN_SHORT[weekday(iso)]) + tt
  const base = fmtDayDate(iso, lang, today) + tt
  if (diff <= -2) return lang === 'zh' ? `${base} · 逾期 ${-diff} 天` : `${base} · ${-diff}d late`
  return base
}

/** 'HH:MM' (24h) → minutes since midnight, or null. */
export function timeToMin(time: string | null): number | null {
  if (!time) return null
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}
export function minToTime(min: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)))
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}
