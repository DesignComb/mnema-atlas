import { Link, useRouterState } from '@tanstack/react-router'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { activeSpace, spaceSubnav, type SubNavItem } from './spaces'

type Tr = (en: string, zh: string) => string
type Search = Record<string, string | undefined>

const keyOf = (item: SubNavItem) => (item.kind === 'route' ? item.to : `${item.param}:${item.value ?? 'default'}`)

/** Default value of a param-driven section (a cleared param). Tempo's "All
 *  tasks" is the default (no ?view=). */
function paramDefault(param: 'view' | 'tab'): string | undefined {
  return param === 'tab' ? 'itinerary' : undefined
}

export function isSubNavActive(item: SubNavItem, pathname: string, search: Search): boolean {
  if (item.kind === 'route') return item.exact ? pathname === item.to : pathname.startsWith(item.to)
  const def = paramDefault(item.param)
  return (search[item.param] ?? def) === (item.value ?? def)
}

/**
 * The within-space navigation strip — a horizontal, swipe-scrollable underline
 * tab row rendered under the PageHeader on phones (lg:hidden; desktop uses the
 * sidebar). Data-driven from spaces.ts: currently Study's pages and Tempo's
 * views. Renders nothing for spaces with no strip (Money/Health/Kitchen keep
 * their own in-page section tabs; a trip detail keeps its own contextual strip).
 */
export function SubNav() {
  const { t } = useI18n()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = useRouterState({ select: (s) => s.location.search as Search })

  const items = spaceSubnav(activeSpace(pathname))
  if (!items.length) return null

  return (
    <nav
      aria-label={t('Sections', '區塊')}
      className="flex items-center gap-0.5 overflow-x-auto px-2 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
    >
      {items.map((item) => (
        <SubNavTab key={keyOf(item)} item={item} pathname={pathname} search={search} t={t} />
      ))}
    </nav>
  )
}

function SubNavTab({ item, pathname, search, t }: { item: SubNavItem; pathname: string; search: Search; t: Tr }) {
  const active = isSubNavActive(item, pathname, search)
  const Icon = item.icon
  const cls = cn(
    '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors',
    active ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
  )
  const inner = (
    <>
      <Icon className="size-3.5" />
      {t(item.en, item.zh)}
    </>
  )
  const aria = active ? ('page' as const) : undefined

  if (item.kind === 'route') {
    return (
      <Link to={item.to} aria-current={aria} className={cls}>
        {inner}
      </Link>
    )
  }
  // Param-driven (Tempo views): set ?view= on /tempo, preserving sibling params.
  return (
    <Link to="/tempo" search={(prev) => ({ ...prev, [item.param]: item.value })} aria-current={aria} className={cls}>
      {inner}
    </Link>
  )
}
