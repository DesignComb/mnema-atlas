import { BookOpenCheck, ChefHat, Coins, GraduationCap, HeartPulse, ListTodo, Map as MapIcon } from 'lucide-react'

/** The top-level spaces — the single source of truth for the rail, the bottom
 *  tabs, and the sidebar header. Each space owns a hue applied by AppLayout's
 *  theme-* class, so the active item just uses the brand tokens. */
export const SPACES = [
  { key: 'study', to: '/today', icon: GraduationCap, en: 'Study', zh: '學習' },
  { key: 'travel', to: '/trips', icon: MapIcon, en: 'Travel', zh: '旅遊' },
  { key: 'tempo', to: '/tempo', icon: ListTodo, en: 'Tempo', zh: '節奏' },
  { key: 'galleon', to: '/galleon', icon: Coins, en: 'Money', zh: '記帳' },
  { key: 'health', to: '/health', icon: HeartPulse, en: 'Health', zh: '健康' },
  { key: 'kitchen', to: '/kitchen', icon: ChefHat, en: 'Kitchen', zh: '廚房' },
] as const

export type SpaceKey = (typeof SPACES)[number]['key']

export const BRAND_ICON = BookOpenCheck

/** Which space a pathname belongs to (Study is the default / catch-all). */
export function activeSpace(pathname: string): SpaceKey {
  if (pathname.startsWith('/trips')) return 'travel'
  if (pathname.startsWith('/tempo')) return 'tempo'
  if (pathname.startsWith('/galleon')) return 'galleon'
  if (pathname.startsWith('/health')) return 'health'
  if (pathname.startsWith('/kitchen')) return 'kitchen'
  return 'study'
}
