import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind class names without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a Date (or ISO string) as a short, human "due in / ago" label. */
export function relativeDue(due: string | Date, now: Date = new Date()): string {
  const d = typeof due === 'string' ? new Date(due) : due
  const ms = d.getTime() - now.getTime()
  const abs = Math.abs(ms)
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  const fmt = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  let label: string
  if (abs < hour) label = fmt(Math.max(1, Math.round(abs / min)), 'min')
  else if (abs < day) label = fmt(Math.round(abs / hour), 'hr')
  else if (abs < 30 * day) label = fmt(Math.round(abs / day), 'day')
  else label = fmt(Math.round(abs / (30 * day)), 'mo')
  return ms >= 0 ? `in ${label}` : `${label} ago`
}
