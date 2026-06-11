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

/** The active app language, readable outside React (same key I18nProvider persists). */
export function appLang(): 'en' | 'zh' {
  try {
    return localStorage.getItem('lang') === 'zh' ? 'zh' : 'en'
  } catch {
    return 'en'
  }
}

/**
 * Map a raw error (usually a Postgres/Supabase sentence) to calm, bilingual
 * copy (audit QW8). Pass a contextual fallback like ['Failed to save', '儲存失敗'];
 * short human-looking messages pass through, raw SQL never reaches the user.
 */
export function humanizeError(err: unknown, fallback?: [string, string]): string {
  const lang = appLang()
  const tt = (en: string, zh: string) => (lang === 'zh' ? zh : en)
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const m = msg.toLowerCase()

  if ((typeof navigator !== 'undefined' && !navigator.onLine) || m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed'))
    return tt('No connection — check your network and try again.', '連不上網路 — 請檢查連線後再試。')
  if (m.includes('timeout') || m.includes('timed out')) return tt('Timed out — try again.', '逾時了,請再試一次。')
  if (m.includes('duplicate key')) return tt('That already exists.', '已經有一筆一樣的了。')
  if (m.includes('row-level security') || m.includes('permission denied') || m.includes('not authorized') || m.includes('forbidden'))
    return tt('You don’t have access to do that.', '你沒有權限執行這個動作。')
  if (m.includes('jwt') || (m.includes('token') && m.includes('expired')) || m.includes('refresh_token'))
    return tt('Your session expired — sign in again.', '登入已過期,請重新登入。')
  if (m.includes('foreign key')) return tt('That item is still linked to something else.', '這筆資料還與其他項目相連。')
  if (m.includes('value too long') || m.includes('too long for type')) return tt('That text is too long.', '文字太長了。')
  if (m.includes('rate limit') || m.includes('too many requests')) return tt('Slow down a moment, then try again.', '稍等一下再試。')

  // Short messages without SQL-ish internals are probably already human.
  const sqlish = /relation |column |constraint |violates |syntax error|p_[a-z_]+|::[a-z]/i.test(msg)
  if (msg && msg.length <= 120 && !sqlish) return msg

  return fallback ? tt(...fallback) : tt('Something went wrong — try again.', '出了點問題,請再試一次。')
}

/** Bilingual placeholder title for freshly created notes (audit QW8). */
export function untitledLabel(): string {
  return appLang() === 'zh' ? '未命名' : 'Untitled'
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
