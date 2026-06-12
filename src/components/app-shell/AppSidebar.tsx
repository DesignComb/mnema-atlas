import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { formatVersion } from '@/lib/ota'
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChefHat,
  ChevronRight,
  Coins,
  FileText,
  Flame,
  GraduationCap,
  HeartPulse,
  HelpCircle,
  Home,
  Inbox,
  Layers,
  ListTodo,
  LogOut,
  Luggage,
  Map as MapIcon,
  Moon,
  Plug,
  Plus,
  Search,
  Share2,
  Sparkles,
  Sun,
  Ticket,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { SPACES, activeSpace, type SpaceKey } from './spaces'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'
import { useDecks, useReorderDecks, useReorderTaskLists, useTaskLists } from '@/lib/hooks'
import { buildDeckTree, type DeckNode } from '@/lib/deck-tree'
import type { DeckRow } from '@/lib/database.types'
import { cn, modKey } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SortableList } from '@/components/common/SortableList'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_STUDY = [
  { to: '/today', label: 'Today', zh: '今天', icon: Home, exact: true },
  { to: '/notes', label: 'Notes', zh: '筆記', icon: FileText, exact: false },
  { to: '/cards', label: 'Flashcards', zh: '閃卡', icon: Layers, exact: false },
  { to: '/graph', label: 'Graph', zh: '圖譜', icon: Share2, exact: false },
  { to: '/study', label: 'Study', zh: '複習', icon: GraduationCap, exact: false },
] as const
const NAV_TRAVEL = [{ to: '/trips', label: 'Trips', zh: '行程', icon: MapIcon, exact: false }] as const
const NAV_TEMPO = [{ to: '/tempo', label: 'Tasks', zh: '任務', icon: ListTodo, exact: false }] as const
const NAV_GALLEON = [{ to: '/galleon', label: 'Money', zh: '記帳', icon: Coins, exact: false }] as const
const NAV_HEALTH = [{ to: '/health', label: 'Health', zh: '健康', icon: HeartPulse, exact: false }] as const
const NAV_KITCHEN = [{ to: '/kitchen', label: 'Kitchen', zh: '廚房', icon: ChefHat, exact: false }] as const

type NavItem = { to: string; label: string; zh: string; icon: LucideIcon; exact: boolean }
/** Per-space sidebar header + primary nav. A Record<SpaceKey, …> so adding a
 *  space to spaces.ts forces a matching entry here (no silent mislabel). */
const SPACE_SIDEBAR: Record<SpaceKey, { brandIcon: LucideIcon; brandTitle: string; nav: readonly NavItem[] }> = {
  study: { brandIcon: BookOpenCheck, brandTitle: 'Mnema Atlas', nav: NAV_STUDY },
  travel: { brandIcon: MapIcon, brandTitle: 'Mnema Voyage', nav: NAV_TRAVEL },
  tempo: { brandIcon: ListTodo, brandTitle: 'Mnema Tempo', nav: NAV_TEMPO },
  galleon: { brandIcon: Coins, brandTitle: 'Mnema Galleon', nav: NAV_GALLEON },
  health: { brandIcon: HeartPulse, brandTitle: 'Mnema Vitals', nav: NAV_HEALTH },
  kitchen: { brandIcon: ChefHat, brandTitle: 'Mnema Kitchen', nav: NAV_KITCHEN },
}
// In the Tempo space the rail shows views (by ?view=) + the user's lists (by ?list=).
const TEMPO_VIEWS = [
  { key: 'today', en: 'Today', zh: '今天', icon: CalendarCheck },
  { key: 'upcoming', en: 'Upcoming', zh: '即將', icon: CalendarClock },
  { key: 'all', en: 'All tasks', zh: '所有任務', icon: ListTodo },
  { key: 'habits', en: 'Habits', zh: '習慣', icon: Flame },
  { key: 'calendar', en: 'Calendar', zh: '行事曆', icon: CalendarDays },
  { key: 'capture', en: 'Capture', zh: '暫存區', icon: Sparkles },
] as const
const TRIP_SECTIONS = [
  { key: 'itinerary', en: 'Itinerary', zh: '行程', icon: CalendarRange },
  { key: 'bookings', en: 'Reservations', zh: '訂位', icon: Ticket },
  { key: 'budget', en: 'Budget', zh: '預算', icon: Wallet },
  { key: 'packing', en: 'Packing', zh: '打包', icon: Luggage },
] as const

export function AppSidebar({
  onOpenCommand,
  onNewDeck,
  onOpenImport,
  className,
  inDrawer,
}: {
  onOpenCommand: () => void
  onNewDeck: () => void
  onOpenImport: () => void
  /** Width + display are set by the caller so the same sidebar serves the
   *  persistent desktop rail and the mobile slide-in drawer. */
  className?: string
  /** In the mobile drawer, reserve space so the brand switcher clears the X close button. */
  inDrawer?: boolean
}) {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { t, lang, setLang } = useI18n()
  const { data: decks } = useDecks()
  const { data: taskLists } = useTaskLists()
  const reorderLists = useReorderTaskLists()
  const reorderDecks = useReorderDecks()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const navigate = useNavigate()

  // Top-level space — the pathname flips the rail. Single source of truth in spaces.ts.
  const space = activeSpace(pathname)
  const { brandIcon: BrandIcon, brandTitle, nav } = SPACE_SIDEBAR[space]
  // On a trip detail page the rail shows that trip's sections instead of the Trips link.
  const tripMatch = pathname.match(/^\/trips\/([0-9a-fA-F-]{36})$/)
  const tripId = tripMatch ? tripMatch[1] : null
  const tripTab = useRouterState({ select: (s) => (s.location.search as { tab?: string }).tab ?? 'itinerary' })
  const tempoView = useRouterState({ select: (s) => (s.location.search as { view?: string }).view ?? 'all' })
  const tempoList = useRouterState({ select: (s) => (s.location.search as { list?: string }).list ?? '' })
  const tempoLists = (taskLists ?? []).filter((l) => !l.is_archived)

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className={cn('h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar', className)}>
      {/* Current space — switching lives in the rail (desktop) / bottom tabs + the
          grid below (mobile drawer). */}
      <div className={cn('px-3 pt-3 pb-2', inDrawer && 'pr-12')}>
        <div className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
            <BrandIcon className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold tracking-tight text-foreground">
            {brandTitle}
          </span>
        </div>
      </div>

      {/* Mobile drawer: ALL spaces. The bottom bar fits only 4 pinned tabs, so
          without this grid the unpinned spaces are unreachable on a phone. */}
      {inDrawer ? (
        <div className="grid grid-cols-3 gap-1 px-3 pb-2">
          {SPACES.map((s) => {
            const isActive = space === s.key
            return (
              <Link
                key={s.key}
                to={s.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'bg-brand-muted text-brand'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
                )}
              >
                <s.icon className="size-5" />
                {t(s.en, s.zh)}
              </Link>
            )
          })}
        </div>
      ) : null}

      {/* Search / Cmd-K */}
      <div className="px-3 pb-2">
        <button
          onClick={onOpenCommand}
          className="flex w-full items-center gap-2 rounded-md border border-transparent bg-sidebar-accent/60 px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:border-border hover:bg-card"
        >
          <Search className="size-3.5" />
          <span>{t('Search…', '搜尋…')}</span>
          <kbd className="ml-auto rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {modKey}K
          </kbd>
        </button>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5 px-3 py-1">
        {tripId ? (
          <>
            <Link
              to="/trips"
              className="mb-0.5 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> {t('All trips', '所有行程')}
            </Link>
            {TRIP_SECTIONS.map((s) => {
              const active = tripTab === s.key
              return (
                <Link
                  key={s.key}
                  to="/trips/$tripId"
                  params={{ tripId }}
                  search={{ tab: s.key }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors',
                    active
                      ? 'bg-brand-muted text-brand'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                  )}
                >
                  <s.icon className="size-4" />
                  {t(s.en, s.zh)}
                </Link>
              )
            })}
          </>
        ) : space === 'tempo' ? (
          TEMPO_VIEWS.map((v) => {
            const active = tempoView === v.key
            return (
              <Link
                key={v.key}
                to="/tempo"
                search={(prev) => ({ ...prev, view: v.key === 'all' ? undefined : v.key })}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors',
                  active
                    ? 'bg-brand-muted text-brand'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                )}
              >
                <v.icon className="size-4" />
                {t(v.en, v.zh)}
              </Link>
            )
          })
        ) : (
          nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors',
                  active
                    ? 'bg-brand-muted text-brand'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                )}
              >
                <item.icon className="size-4" />
                {t(item.label, item.zh)}
              </Link>
            )
          })
        )}
      </nav>

      {space === 'study' ? (
      <>
      {/* Decks */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {t('Decks', '牌組')}
        </span>
        <button
          onClick={onNewDeck}
          className="rounded p-0.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          title="New deck"
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-0.5 pb-4">
          {decks?.length ? (
            <DeckTreeNav decks={decks} pathname={pathname} onReorder={(ids) => reorderDecks.mutate(ids)} />
          ) : (
            <p className="px-2.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground/70">
              {t('No decks yet. Create one, or let a connected AI add content.', '還沒有牌組。建立一個,或讓連接的 AI 幫你新增。')}
            </p>
          )}
        </div>
      </ScrollArea>
      </>
      ) : space === 'tempo' ? (
      <>
      {/* Lists */}
      <div className="flex items-center justify-between px-4 pt-4 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          {t('Lists', '清單')}
        </span>
        <Link
          to="/tempo"
          search={(prev) => ({ ...prev, new: 'list' })}
          className="rounded p-0.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          title={t('New list', '新增清單')}
        >
          <Plus className="size-3.5" />
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="flex flex-col gap-0.5 pb-4">
          <Link
            to="/tempo"
            search={(prev) => ({ ...prev, list: undefined })}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
              tempoList === ''
                ? 'bg-sidebar-accent text-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
            )}
          >
            <ListTodo className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{t('All lists', '全部清單')}</span>
          </Link>
          <Link
            to="/tempo"
            search={(prev) => ({ ...prev, list: 'inbox' })}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
              tempoList === 'inbox'
                ? 'bg-sidebar-accent text-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
            )}
          >
            <Inbox className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{t('Inbox', '收件匣')}</span>
          </Link>
          <SortableList
            items={tempoLists}
            onReorder={(ids) => reorderLists.mutate(ids)}
            itemClassName="rounded-md bg-sidebar"
            renderItem={(list, handle) => {
              const active = tempoList === list.id
              return (
                <div className="group flex items-center">
                  {handle}
                  <Link
                    to="/tempo"
                    search={(prev) => ({ ...prev, list: list.id })}
                    className={cn(
                      'flex min-w-0 flex-1 items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                      active
                        ? 'bg-sidebar-accent text-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                    )}
                  >
                    {list.icon ? (
                      <span className="shrink-0 text-[13px] leading-none">{list.icon}</span>
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full bg-brand/50" />
                    )}
                    <span className="truncate">{list.name}</span>
                  </Link>
                </div>
              )
            }}
          />
        </div>
      </ScrollArea>
      </>
      ) : (
        <div className="flex-1" />
      )}

      {/* Footer: pinned guide + user menu */}
      <div className="space-y-0.5 border-t border-sidebar-border p-2">
        <div className="flex items-center gap-1">
          <Link
            to="/guide"
            className="flex flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-foreground"
          >
            <HelpCircle className="size-4" /> {t('How it works', '使用教學')}
          </Link>
          <button
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
            title="Language / 語言"
          >
            {lang === 'zh' ? 'EN' : '中'}
          </button>
          <button
            onClick={toggle}
            className="rounded-md p-1.5 text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground"
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-sidebar-accent">
              <Avatar>
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{user?.email}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56 max-w-[calc(100vw-1.5rem)]">
            <DropdownMenuItem onSelect={() => onOpenImport()}>
              <Sparkles /> {t('Import from AI', '從 AI 匯入')}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings/integrations">
                <Plug /> {t('Connect an AI', '連接 AI')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async () => {
                await signOut()
                navigate({ to: '/' })
              }}
            >
              <LogOut /> {t('Sign out', '登出')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <VersionStamp />
      </div>
    </aside>
  )
}

/** Build stamp so "is my version current?" is answerable at a glance —
 *  web bundle version (+ APK versionName/code in the native shell). */
function VersionStamp() {
  const [apk, setApk] = useState<string | null>(null)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    CapApp.getInfo()
      .then((i) => setApk(`APK ${i.version} (${i.build})`))
      .catch(() => {})
  }, [])
  return (
    <p className="select-text px-2 pt-1 text-[10.5px] tabular-nums text-muted-foreground/60">
      v{formatVersion()}
      {apk ? ` · ${apk}` : ''}
    </p>
  )
}

// ── Deck tree (Notion-like nesting) ───────────────────────────────
// Expand/collapse state persists across sessions; absent = expanded.
const DECK_EXPANDED_KEY = 'mnema:deck-expanded'

function readExpandedMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DECK_EXPANDED_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

/**
 * Nested deck nav. Each same-parent sibling group is its own sortable scope,
 * so a drag can never move a deck across parents — reorder_decks must only be
 * called with same-parent siblings. Re-parenting happens on the deck page
 * ("Move to"), not by dragging.
 */
function DeckTreeNav({
  decks,
  pathname,
  onReorder,
}: {
  decks: DeckRow[]
  pathname: string
  onReorder: (siblingIds: string[]) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(readExpandedMap)
  const tree = useMemo(() => buildDeckTree(decks), [decks])
  const toggle = (id: string) =>
    setExpanded(() => {
      // Two instances are mounted (desktop rail + mobile drawer): merge over the
      // freshly-read STORED map so one instance can't wipe the other's toggles.
      const stored = readExpandedMap()
      const next = { ...stored, [id]: !(stored[id] ?? true) }
      try {
        localStorage.setItem(DECK_EXPANDED_KEY, JSON.stringify(next))
      } catch {
        /* storage unavailable — collapse state just won't persist */
      }
      return next
    })
  return (
    <DeckTreeLevel
      nodes={tree}
      depth={0}
      expanded={expanded}
      onToggle={toggle}
      pathname={pathname}
      onReorder={onReorder}
    />
  )
}

function DeckTreeLevel({
  nodes,
  depth,
  expanded,
  onToggle,
  pathname,
  onReorder,
}: {
  nodes: DeckNode<DeckRow>[]
  depth: number
  expanded: Record<string, boolean>
  onToggle: (id: string) => void
  pathname: string
  onReorder: (siblingIds: string[]) => void
}) {
  const { t } = useI18n()
  // SortableList keeps an optimistic copy keyed by ids — read names/children
  // from the latest props at render time so renames and new sub-decks show up.
  const nodeById = new Map(nodes.map((n) => [n.deck.id, n]))
  const anyKids = nodes.some((n) => n.children.length > 0)
  return (
    <SortableList
      items={nodes.map((n) => n.deck)}
      onReorder={onReorder}
      itemClassName="rounded-md bg-sidebar"
      renderItem={(item, handle) => {
        const node = nodeById.get(item.id)
        if (!node) return null
        const { deck } = node
        const hasKids = node.children.length > 0
        const open = expanded[deck.id] ?? true
        const active = pathname === `/decks/${deck.id}`
        return (
          <>
            <div className="group flex items-center" style={depth ? { paddingLeft: depth * 12 } : undefined}>
              {handle}
              {hasKids ? (
                <button
                  type="button"
                  onClick={() => onToggle(deck.id)}
                  aria-expanded={open}
                  aria-label={
                    open ? t(`Collapse “${deck.name}”`, `收合「${deck.name}」`) : t(`Expand “${deck.name}”`, `展開「${deck.name}」`)
                  }
                  // -my keeps the row height; the padding buys a ≥26px hit area.
                  className="-my-1 shrink-0 rounded p-1.5 text-muted-foreground/70 transition hover:bg-sidebar-accent hover:text-foreground"
                >
                  <ChevronRight className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                </button>
              ) : anyKids ? (
                // Keep names aligned when some siblings have a chevron (14px icon + 12px padding).
                <span className="w-[26px] shrink-0" aria-hidden />
              ) : null}
              <Link
                to="/decks/$deckId"
                params={{ deckId: deck.id }}
                className={cn(
                  'flex min-w-0 flex-1 items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                  active
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                )}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-brand/50" />
                <span className="truncate">{deck.name}</span>
              </Link>
            </div>
            {hasKids && open ? (
              <DeckTreeLevel
                nodes={node.children}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                pathname={pathname}
                onReorder={onReorder}
              />
            ) : null}
          </>
        )
      }}
    />
  )
}
