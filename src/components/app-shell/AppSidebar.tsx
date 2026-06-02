import { Link, useRouterState } from '@tanstack/react-router'
import {
  ArrowLeft,
  BookOpenCheck,
  CalendarRange,
  Check,
  ChevronsUpDown,
  FileText,
  GraduationCap,
  HelpCircle,
  Home,
  Layers,
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
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { useI18n } from '@/lib/i18n'
import { useDecks } from '@/lib/hooks'
import { cn, modKey } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV_STUDY = [
  { to: '/', label: 'Today', zh: '今天', icon: Home, exact: true },
  { to: '/notes', label: 'Notes', zh: '筆記', icon: FileText, exact: false },
  { to: '/cards', label: 'Flashcards', zh: '閃卡', icon: Layers, exact: false },
  { to: '/graph', label: 'Graph', zh: '圖譜', icon: Share2, exact: false },
  { to: '/study', label: 'Study', zh: '複習', icon: GraduationCap, exact: false },
] as const
const NAV_TRAVEL = [{ to: '/trips', label: 'Trips', zh: '行程', icon: MapIcon, exact: false }] as const
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
}: {
  onOpenCommand: () => void
  onNewDeck: () => void
  onOpenImport: () => void
  /** Width + display are set by the caller so the same sidebar serves the
   *  persistent desktop rail and the mobile slide-in drawer. */
  className?: string
}) {
  const { user, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { t, lang, setLang } = useI18n()
  const { data: decks } = useDecks()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  // Top-level space: Study vs Travel. Travel routes (/trips, /s) flip the rail.
  const space: 'study' | 'travel' = pathname.startsWith('/trips') ? 'travel' : 'study'
  const nav = space === 'travel' ? NAV_TRAVEL : NAV_STUDY
  // On a trip detail page the rail shows that trip's sections instead of the Trips link.
  const tripMatch = pathname.match(/^\/trips\/([0-9a-fA-F-]{36})$/)
  const tripId = tripMatch ? tripMatch[1] : null
  const tripTab = useRouterState({ select: (s) => (s.location.search as { tab?: string }).tab ?? 'itinerary' })

  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <aside className={cn('h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar', className)}>
      {/* Brand + space switcher (dropdown) */}
      <div className="px-3 pt-3 pb-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-sidebar-accent">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand text-brand-foreground shadow-sm">
                {space === 'travel' ? <MapIcon className="size-4" /> : <BookOpenCheck className="size-4" />}
              </span>
              <span className="min-w-0 flex-1 truncate font-serif text-[16px] font-semibold tracking-tight text-foreground">
                {space === 'travel' ? 'Mnema Travel' : 'Mnema Atlas'}
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[14.5rem]">
            <DropdownMenuItem asChild>
              <Link to="/">
                <BookOpenCheck className="text-brand" />
                <span className="flex-1">Mnema Atlas</span>
                <span className="text-[11px] text-muted-foreground">{t('Study', '讀書')}</span>
                {space === 'study' ? <Check className="ml-1 size-4 text-brand" /> : null}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/trips">
                <MapIcon className="text-brand" />
                <span className="flex-1">Mnema Travel</span>
                <span className="text-[11px] text-muted-foreground">{t('Travel', '旅遊')}</span>
                {space === 'travel' ? <Check className="ml-1 size-4 text-brand" /> : null}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
            decks.map((deck) => {
              const active = pathname === `/decks/${deck.id}`
              return (
                <Link
                  key={deck.id}
                  to="/decks/$deckId"
                  params={{ deckId: deck.id }}
                  className={cn(
                    'group flex items-center gap-2 truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'bg-sidebar-accent text-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground',
                  )}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-brand/50" />
                  <span className="truncate">{deck.name}</span>
                </Link>
              )
            })
          ) : (
            <p className="px-2.5 py-2 text-[12.5px] leading-relaxed text-muted-foreground/70">
              {t('No decks yet. Create one, or let a connected AI add content.', '還沒有牌組。建立一個,或讓連接的 AI 幫你新增。')}
            </p>
          )}
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
            <DropdownMenuItem onSelect={() => void signOut()}>
              <LogOut /> {t('Sign out', '登出')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
