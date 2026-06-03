import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind class names without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Platform-correct modifier key for shortcut hints (⌘ on Mac, Ctrl elsewhere). */
export const modKey =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

/**
 * Format a Date (or ISO string) as a short, human "due in / ago" label, in the
 * active language. Pass `lang` so it follows the app's EN/ZH toggle rather than
 * the OS locale.
 */
export function relativeDue(due: string | Date, now: Date = new Date(), lang: 'en' | 'zh' = 'en'): string {
  const d = typeof due === 'string' ? new Date(due) : due
  const ms = d.getTime() - now.getTime()
  const future = ms >= 0
  const abs = Math.abs(ms)
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  let n: number
  let unit: 'min' | 'hr' | 'day' | 'mo'
  if (abs < hour) {
    n = Math.max(1, Math.round(abs / min))
    unit = 'min'
  } else if (abs < day) {
    n = Math.round(abs / hour)
    unit = 'hr'
  } else if (abs < 30 * day) {
    n = Math.round(abs / day)
    unit = 'day'
  } else {
    n = Math.round(abs / (30 * day))
    unit = 'mo'
  }
  if (lang === 'zh') {
    const u = { min: '分鐘', hr: '小時', day: '天', mo: '個月' }[unit]
    return future ? `${n} ${u}後` : `${n} ${u}前`
  }
  const label = `${n} ${unit}${n === 1 ? '' : 's'}`
  return future ? `in ${label}` : `${label} ago`
}

/** Absolute date label that follows the app language (not the OS locale). */
export function fmtLocalDate(
  date: string | Date,
  lang: 'en' | 'zh' = 'en',
  opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return d.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', opts)
  } catch {
    return d.toDateString()
  }
}

/** Make a string safe to use as a download filename. */
export function safeFilename(name: string, fallback = 'untitled'): string {
  const cleaned = name
    .trim()
    .replace(/[/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim()
  return cleaned || fallback
}

/** Trigger a client-side download of a text file (export). */
export function downloadText(filename: string, text: string, mime = 'text/markdown;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
