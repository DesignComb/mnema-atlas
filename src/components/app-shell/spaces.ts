import {
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChefHat,
  Coins,
  FileText,
  Flame,
  GraduationCap,
  HeartPulse,
  Home,
  Layers,
  Library,
  ListTodo,
  ListTree,
  Luggage,
  Map as MapIcon,
  MapPin,
  Share2,
  Sparkles,
  Ticket,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

/** The top-level spaces — the single source of truth for the rail, the bottom
 *  tabs, the Spaces sheet, and the sidebar header. Each space owns a hue applied
 *  by AppLayout's theme-* class, so the active item just uses the brand tokens.
 *  `anchor` marks the spaces fixed on the mobile bottom bar; the rest live one
 *  tap away under the bar's "Spaces" tab. `brandTitle` is the per-space wordmark
 *  (kept here so adding a space is a one-file edit). */
export const SPACES = [
  { key: 'study', to: '/today', icon: GraduationCap, en: 'Study', zh: '學習', brandTitle: 'Mnema Atlas', anchor: true },
  { key: 'travel', to: '/trips', icon: MapIcon, en: 'Travel', zh: '旅遊', brandTitle: 'Mnema Voyage', anchor: false },
  { key: 'tempo', to: '/tempo', icon: ListTodo, en: 'Tempo', zh: '節奏', brandTitle: 'Mnema Tempo', anchor: true },
  { key: 'galleon', to: '/galleon', icon: Coins, en: 'Money', zh: '記帳', brandTitle: 'Mnema Galleon', anchor: true },
  { key: 'health', to: '/health', icon: HeartPulse, en: 'Health', zh: '健康', brandTitle: 'Mnema Vitals', anchor: false },
  { key: 'kitchen', to: '/kitchen', icon: ChefHat, en: 'Kitchen', zh: '廚房', brandTitle: 'Mnema Kitchen', anchor: false },
] as const

export type SpaceKey = (typeof SPACES)[number]['key']

export const BRAND_ICON = BookOpenCheck

/** The (fixed) spaces that sit on the mobile bottom bar, in order. */
export const ANCHOR_KEYS: SpaceKey[] = SPACES.filter((s) => s.anchor).map((s) => s.key)

/** Which space a pathname belongs to (Study is the default / catch-all). */
export function activeSpace(pathname: string): SpaceKey {
  if (pathname.startsWith('/trips')) return 'travel'
  if (pathname.startsWith('/places')) return 'travel'
  if (pathname.startsWith('/tempo')) return 'tempo'
  if (pathname.startsWith('/galleon')) return 'galleon'
  if (pathname.startsWith('/health')) return 'health'
  if (pathname.startsWith('/kitchen')) return 'kitchen'
  return 'study'
}

export function brandTitleFor(space: SpaceKey): string {
  return SPACES.find((s) => s.key === space)!.brandTitle
}

// ── Within-space sub-navigation (the mobile SubNav strip + the desktop sidebar
//    both read these, so a space's sub-nav is defined exactly once). ──────────
//
// A sub-nav item is either a distinct route, or a ?param=value on the space's
// own screen (Tempo views, trip sections). `value: undefined` = the default
// (cleared param). Trip-detail items carry tripId at render time (see SubNav).
export type SubNavItem = {
  en: string
  zh: string
  icon: LucideIcon
} & (
  | { kind: 'route'; to: string; exact?: boolean }
  | { kind: 'param'; param: 'view' | 'tab'; value?: string }
)

/** Study: distinct routes; the last item drills into the full-screen deck tree. */
export const STUDY_NAV: SubNavItem[] = [
  { kind: 'route', to: '/today', exact: true, en: 'Today', zh: '今天', icon: Home },
  { kind: 'route', to: '/notes', en: 'Notes', zh: '筆記', icon: FileText },
  { kind: 'route', to: '/cards', en: 'Flashcards', zh: '閃卡', icon: Layers },
  { kind: 'route', to: '/graph', en: 'Graph', zh: '圖譜', icon: Share2 },
  { kind: 'route', to: '/study', en: 'Study', zh: '學習', icon: GraduationCap },
  { kind: 'route', to: '/decks', en: 'Decks', zh: '牌組', icon: Library },
]

/** Travel: distinct routes — the trips list and the "想去" places wishlist. */
export const TRAVEL_NAV: SubNavItem[] = [
  { kind: 'route', to: '/trips', en: 'Trips', zh: '行程', icon: MapIcon },
  { kind: 'route', to: '/places', en: 'Places', zh: '想去', icon: MapPin },
]

/** Tempo: ?view= on /tempo; the last item drills into the full-screen list picker. */
export const TEMPO_VIEWS: SubNavItem[] = [
  { kind: 'param', param: 'view', value: 'today', en: 'Today', zh: '今天', icon: CalendarCheck },
  { kind: 'param', param: 'view', value: 'upcoming', en: 'Upcoming', zh: '即將', icon: CalendarClock },
  { kind: 'param', param: 'view', value: undefined, en: 'All tasks', zh: '所有任務', icon: ListTodo },
  { kind: 'param', param: 'view', value: 'habits', en: 'Habits', zh: '習慣', icon: Flame },
  { kind: 'param', param: 'view', value: 'calendar', en: 'Calendar', zh: '行事曆', icon: CalendarDays },
  { kind: 'param', param: 'view', value: 'capture', en: 'Capture', zh: '暫存區', icon: Sparkles },
  { kind: 'param', param: 'view', value: 'lists', en: 'Lists', zh: '清單', icon: ListTree },
]

/** Trip detail: ?tab= on /trips/$tripId (tripId supplied by SubNav at render). */
export const TRIP_SECTIONS: SubNavItem[] = [
  { kind: 'param', param: 'tab', value: 'itinerary', en: 'Itinerary', zh: '行程', icon: CalendarRange },
  { kind: 'param', param: 'tab', value: 'bookings', en: 'Reservations', zh: '訂位', icon: Ticket },
  { kind: 'param', param: 'tab', value: 'budget', en: 'Budget', zh: '預算', icon: Wallet },
  { kind: 'param', param: 'tab', value: 'packing', en: 'Packing', zh: '打包', icon: Luggage },
]

// Focused detail/editor screens get NO strip (and therefore no swipe-nav): a
// note editor or deck detail shouldn't let a stray horizontal swipe flip away.
const NO_STRIP = /^\/(notes|decks|trips)\/[^/]+/

/** The sub-nav items for the current screen (empty = no strip; e.g. Money/
 *  Health/Kitchen keep their own in-page section tabs, the /trips index has
 *  none, a trip *detail* keeps its own strip, and note/deck detail pages are
 *  intentionally strip-free). */
export function spaceSubnav(space: SpaceKey, pathname = ''): SubNavItem[] {
  if (NO_STRIP.test(pathname)) return []
  if (space === 'study') return STUDY_NAV
  if (space === 'tempo') return TEMPO_VIEWS
  if (space === 'travel') return TRAVEL_NAV
  return []
}
