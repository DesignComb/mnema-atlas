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
