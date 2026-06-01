import type { LucideIcon } from 'lucide-react'
import { Bed, Camera, MapPin, ShoppingBag, Ticket, TrainFront, Utensils } from 'lucide-react'

/** Category presentation — icon, bilingual label, accent dot, and chip classes. */
export type Category = 'food' | 'transport' | 'sight' | 'lodging' | 'activity' | 'shopping' | 'other'

export const CATEGORIES: Category[] = ['sight', 'food', 'activity', 'transport', 'lodging', 'shopping', 'other']

export const CATEGORY_META: Record<
  Category,
  { icon: LucideIcon; en: string; zh: string; dot: string; chip: string }
> = {
  sight: {
    icon: Camera,
    en: 'Sight',
    zh: '景點',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  },
  food: {
    icon: Utensils,
    en: 'Food',
    zh: '餐飲',
    dot: 'bg-amber-500',
    chip: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300',
  },
  transport: {
    icon: TrainFront,
    en: 'Transport',
    zh: '交通',
    dot: 'bg-sky-500',
    chip: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  },
  lodging: {
    icon: Bed,
    en: 'Lodging',
    zh: '住宿',
    dot: 'bg-violet-500',
    chip: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
  },
  activity: {
    icon: Ticket,
    en: 'Activity',
    zh: '活動',
    dot: 'bg-rose-500',
    chip: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
  },
  shopping: {
    icon: ShoppingBag,
    en: 'Shopping',
    zh: '購物',
    dot: 'bg-orange-500',
    chip: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300',
  },
  other: {
    icon: MapPin,
    en: 'Other',
    zh: '其他',
    dot: 'bg-slate-400',
    chip: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300',
  },
}

export function categoryOf(c: string | null | undefined): Category {
  return CATEGORIES.includes(c as Category) ? (c as Category) : 'other'
}

/** 'HH:MM:SS' / 'HH:MM' → 'HH:MM'. */
export function fmtTime(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

export function fmtTimeRange(start: string | null, end: string | null, endOffset = 0): string {
  const s = fmtTime(start)
  const e = fmtTime(end)
  if (s && e) return `${s}–${e}${endOffset ? ` +${endOffset}d` : ''}`
  return s || e
}

/** Deep-link to Google/Apple Maps from coordinates (preferred) or a place name. */
export function mapsUrl(place: string | null, lat: number | null, lng: number | null): string | null {
  if (lat != null && lng != null) return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  const p = place?.trim()
  if (p) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p)}`
  return null
}

/** Only allow https links to be rendered (blocks javascript:/data: in shared views). */
export function safeHttps(url: string | null): string | null {
  const u = url?.trim()
  return u && /^https:\/\//i.test(u) ? u : null
}

export function fmtCost(cost: number | null, currency: string | null): string {
  if (cost == null) return ''
  const n = Number(cost)
  const s = Number.isInteger(n)
    ? n.toLocaleString()
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${currency ? currency + ' ' : ''}${s}`
}

export function fmtDateRange(start: string | null, end: string | null): string {
  if (start && end) return start === end ? start : `${start} – ${end}`
  return start || end || ''
}
