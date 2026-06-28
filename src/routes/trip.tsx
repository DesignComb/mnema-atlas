import { humanizeError, cn } from '@/lib/utils'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  List,
  Luggage,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  SlidersHorizontal,
  Table2,
  Ticket,
  Trash2,
  Users,
  Wallet,
  X,
  Map as MapIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeleteDay,
  useDeleteItem,
  useDeleteItinerary,
  useItinerary,
  useItineraryRealtime,
  useReorderDays,
  useReorderItems,
  useSetItemDay,
} from '@/lib/hooks'
import type { ItineraryDay, ItineraryItem } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { TripDialog } from '@/components/trips/TripDialog'
import { DayDialog } from '@/components/trips/DayDialog'
import { SortableList } from '@/components/common/SortableList'
import { ItemDialog } from '@/components/trips/ItemDialog'
import { ShareDialog } from '@/components/trips/ShareDialog'
import { MembersDialog } from '@/components/trips/MembersDialog'
import { BookingsTab, BudgetTab, PackingTab } from '@/components/trips/TripSections'
import { ItineraryBoard, ItineraryTable } from '@/components/trips/ItineraryViews'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type TripTab = 'itinerary' | 'bookings' | 'budget' | 'packing'
type ItinView = 'timeline' | 'table' | 'board'
import { Button } from '@/components/ui/button'
import {
  CATEGORIES,
  CATEGORY_META,
  STATUS_META,
  STATUS_ORDER,
  type Category,
  type ItemStatus,
  categoryOf,
  fmtCost,
  fmtDateRange,
  fmtTimeRange,
  mapsUrl,
  safeHttps,
  statusOf,
} from '@/lib/itinerary'
import { useI18n, useT } from '@/lib/i18n'
import { fmtDayDate } from '@/lib/tempo-date'
import { tagChipStyle, tagColor } from '@/lib/tags'
import { useTheme } from '@/lib/theme'

export function TripScreen() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: trip, isLoading, isError } = useItinerary(tripId)
  const deleteTrip = useDeleteItinerary()
  const deleteDay = useDeleteDay()
  const deleteItem = useDeleteItem()
  const reorderDays = useReorderDays()
  const reorderItems = useReorderItems()
  const setItemDayQuick = useSetItemDay()
  const navigate = useNavigate()
  const t = useT()
  useItineraryRealtime(tripId)

  const search = useSearch({ strict: false }) as { tab?: TripTab }
  const tab: TripTab = search.tab ?? 'itinerary'
  const setTab = (next: TripTab) => navigate({ to: '/trips/$tripId', params: { tripId }, search: { tab: next } })
  const [view, setView] = useState<ItinView>('timeline')
  const [hiddenCats, setHiddenCats] = useState<Set<Category>>(new Set())
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<ItemStatus>>(new Set())
  // Drag-to-reorder needs every row present; with a filter on, some are hidden,
  // so fall back to the ⋯ "move up/down" menu (which is always available).
  const filtering = hiddenCats.size > 0 || hiddenStatuses.size > 0
  const [tripDialog, setTripDialog] = useState(false)
  const [shareDialog, setShareDialog] = useState(false)
  const [membersDialog, setMembersDialog] = useState(false)
  const [dayDialog, setDayDialog] = useState<{ open: boolean; day?: ItineraryDay }>({ open: false })
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: ItineraryItem; dayId?: string | null }>({
    open: false,
  })
  const [confirmDel, setConfirmDel] = useState(false)
  // "想去" wishlist panel filters (local, not URL): area tag + category set.
  const [unschedTag, setUnschedTag] = useState<string | null>(null)
  const [unschedCats, setUnschedCats] = useState<Set<Category>>(new Set())
  const [wishlistOpen, setWishlistOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('mnema:wishlist-open') !== '0'
    } catch {
      return true
    }
  })
  const toggleWishlist = () =>
    setWishlistOpen((v) => {
      const next = !v
      try {
        localStorage.setItem('mnema:wishlist-open', next ? '1' : '0')
      } catch {
        /* storage unavailable — just won't persist */
      }
      return next
    })
  const toggleUnschedCat = (c: Category) =>
    setUnschedCats((prev) => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c)
      else next.add(c)
      return next
    })

  async function removeTrip() {
    if (!confirmDel) {
      setConfirmDel(true)
      return
    }
    try {
      await deleteTrip.mutateAsync(tripId)
      toast.success(t('Trip deleted', '已刪除行程'))
      navigate({ to: '/trips' })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to delete trip', '刪除行程失敗']))
    }
  }

  function moveDay(index: number, dir: -1 | 1) {
    if (!trip) return
    const ids = trip.days.map((d) => d.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    reorderDays.mutate({ itineraryId: trip.id, dayIds: ids })
  }

  function moveItem(list: ItineraryItem[], dayId: string | null, index: number, dir: -1 | 1) {
    const ids = list.map((i) => i.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    reorderItems.mutate({ dayId, itemIds: ids })
  }

  async function removeDay(day: ItineraryDay) {
    try {
      await deleteDay.mutateAsync(day.id)
      toast.success(t('Day removed — activities moved to Unscheduled', '已移除這一天——活動移至未排程'))
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to remove day', '移除日期失敗']))
    }
  }

  async function removeItem(item: ItineraryItem) {
    if (!trip) return
    try {
      await deleteItem.mutateAsync({ id: item.id, tripId: trip.id })
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to delete activity', '刪除活動失敗']))
    }
  }

  const openItem = (item: ItineraryItem) => setItemDialog({ open: true, item, dayId: item.day_id })

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('Trip', '行程')} icon={<MapIcon className="size-4" />} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-5xl space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-card" />
            ))}
          </div>
        </div>
      </>
    )
  }

  if (isError || !trip) {
    return (
      <>
        <PageHeader title={t('Trip', '行程')} icon={<MapIcon className="size-4" />} />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={<MapIcon className="size-6" />}
            title={t('Trip not found', '找不到這個行程')}
            description={t('It may have been deleted.', '它可能已經被刪除了。')}
            action={
              <Button asChild variant="brand" size="sm">
                <Link to="/trips">{t('All trips', '所有行程')}</Link>
              </Button>
            }
          />
        </div>
      </>
    )
  }

  const dates = fmtDateRange(trip.start_date, trip.end_date)
  const subtitle = [trip.destination, dates].filter(Boolean).join(' · ')
  const costEntries = Object.entries(trip.cost_by_currency ?? {})
  const isOwner = trip.my_role === 'owner'
  const canEdit = isOwner || trip.my_role === 'editor'

  // Filter: hide selected categories / statuses across all itinerary views.
  const matchItem = (i: ItineraryItem) =>
    !hiddenCats.has(categoryOf(i.category)) && !hiddenStatuses.has(statusOf(i.status))
  const filterActive = hiddenCats.size > 0 || hiddenStatuses.size > 0
  const allItems = [...trip.days.flatMap((d) => d.items), ...trip.unscheduled]
  const catsPresent = CATEGORIES.filter((c) => allItems.some((i) => categoryOf(i.category) === c))
  // Tags: all for the item dialog's suggestions; the unscheduled subset drives
  // the "想去" tag filter chips.
  const allTags = Array.from(new Set(allItems.flatMap((i) => i.tags ?? []))).sort((a, b) => a.localeCompare(b))
  const unschedTags = Array.from(new Set(trip.unscheduled.flatMap((i) => i.tags ?? []))).sort((a, b) =>
    a.localeCompare(b),
  )
  // Drop a stale tag selection if nothing carries it anymore.
  const activeUnschedTag = unschedTag && unschedTags.includes(unschedTag) ? unschedTag : null
  // Categories actually present among the "想去" candidates, in canonical order.
  const unschedCatsPresent = CATEGORIES.filter((c) => trip.unscheduled.some((i) => categoryOf(i.category) === c))
  const wishlistFiltering = unschedCats.size > 0 || activeUnschedTag != null
  const shownUnscheduled = trip.unscheduled.filter(
    (i) =>
      (unschedCats.size === 0 || unschedCats.has(categoryOf(i.category))) &&
      (!activeUnschedTag || i.tags?.includes(activeUnschedTag)),
  )
  const scheduleItem = (itemId: string, dayId: string) =>
    setItemDayQuick.mutate({ itemId, dayId, tripId: trip.id })
  const fTrip = filterActive
    ? {
        ...trip,
        days: trip.days.map((d) => ({ ...d, items: d.items.filter(matchItem) })),
        unscheduled: trip.unscheduled.filter(matchItem),
      }
    : trip

  return (
    <>
      <PageHeader
        title={trip.title}
        subtitle={subtitle || undefined}
        icon={<MapIcon className="size-4" />}
        actions={
          <>
            {canEdit ? (
              <Button variant="outline" size="sm" onClick={() => setDayDialog({ open: true })}>
                <CalendarPlus className="size-4" /> <span className="hidden sm:inline">{t('Day', '日期')}</span>
              </Button>
            ) : null}
            {isOwner ? (
              <Button variant="outline" size="sm" onClick={() => setShareDialog(true)}>
                <Share2 className="size-4" /> <span className="hidden sm:inline">{t('Share', '分享')}</span>
              </Button>
            ) : null}
            {isOwner ? (
              <Button variant="outline" size="sm" onClick={() => setMembersDialog(true)}>
                <Users className="size-4" /> <span className="hidden sm:inline">{t('Collaborate', '共享')}</span>
              </Button>
            ) : null}
            {canEdit ? (
              <Button variant="ghost" size="sm" onClick={() => setTripDialog(true)} title={t('Edit trip', '編輯行程')}>
                <Pencil className="size-4" />
              </Button>
            ) : null}
            {isOwner ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={removeTrip}
                onBlur={() => setConfirmDel(false)}
                className={confirmDel ? 'text-destructive' : 'text-muted-foreground'}
                title={t('Delete trip', '刪除行程')}
              >
                <Trash2 className="size-4" />
                {confirmDel ? t('Delete?', '確定刪除？') : null}
              </Button>
            ) : null}
          </>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/trips"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" /> {t('All trips', '所有行程')}
            </Link>
            {!isOwner ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                {trip.my_role === 'editor'
                  ? t('Shared · can edit', '共享 · 可編輯')
                  : t('Shared · view only', '共享 · 唯讀')}
              </span>
            ) : null}
          </div>

          {/* Travelers */}
          {trip.travelers.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {trip.travelers.map((name) => (
                <span key={name} className="rounded-full bg-muted px-2 py-0.5 text-[12px] text-muted-foreground">
                  {name}
                </span>
              ))}
            </div>
          ) : null}

          {/* Section nav (underline) — mobile only; desktop uses the sidebar */}
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border lg:hidden">
            {(
              [
                ['itinerary', 'Itinerary', '行程', CalendarRange],
                ['bookings', 'Reservations', '訂位', Ticket],
                ['budget', 'Budget', '預算', Wallet],
                ['packing', 'Packing', '打包', Luggage],
              ] as const
            ).map(([k, en, zh, Icon]) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition ${tab === k ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon className="size-4" /> {t(en, zh)}
              </button>
            ))}
          </div>

          {tab === 'bookings' ? <BookingsTab trip={trip} canEdit={canEdit} /> : null}
          {tab === 'budget' ? <BudgetTab trip={trip} /> : null}
          {tab === 'packing' ? <PackingTab trip={trip} canEdit={canEdit} /> : null}

          {tab === 'itinerary' ? (
            <>
          {/* 想去 wishlist — collapsible, quick filter by category/area + one-tap schedule */}
          {trip.unscheduled.length || canEdit ? (
            <section className="rounded-xl border border-border bg-card shadow-soft">
              <div className="flex items-center gap-2 px-3 py-2.5 sm:px-4">
                <button
                  type="button"
                  onClick={toggleWishlist}
                  aria-expanded={wishlistOpen}
                  className="flex items-center gap-1.5 text-sm font-semibold text-foreground"
                >
                  {wishlistOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  {t('Wishlist', '想去')}
                  <span className="font-normal text-muted-foreground">· {trip.unscheduled.length}</span>
                </button>
                {canEdit ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setItemDialog({ open: true, dayId: null })}
                  >
                    <Plus className="size-4" /> {t('Idea', '想去')}
                  </Button>
                ) : null}
              </div>
              {wishlistOpen ? (
                <div className="space-y-2.5 border-t border-border px-3 py-3 sm:px-4">
                  {/* Quick filters: category (店家/景點…) + area tags */}
                  {unschedCatsPresent.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {unschedCatsPresent.map((c) => {
                        const meta = CATEGORY_META[c]
                        const Icon = meta.icon
                        const active = unschedCats.has(c)
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => toggleUnschedCat(c)}
                            aria-pressed={active}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/50',
                              active
                                ? 'border-brand/40 ring-1 ring-brand/30 text-foreground'
                                : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
                            )}
                          >
                            <Icon className="size-3.5" /> {t(meta.en, meta.zh)}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}
                  {unschedTags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {unschedTags.map((tg) => {
                        const active = tg === activeUnschedTag
                        return (
                          <button
                            key={tg}
                            type="button"
                            onClick={() => setUnschedTag(active ? null : tg)}
                            aria-pressed={active}
                            className={cn(
                              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/50',
                              active
                                ? 'border-brand/40 ring-1 ring-brand/30 text-foreground'
                                : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
                            )}
                            title={t(`Filter “${tg}”`, `篩選「${tg}」`)}
                          >
                            <span className="size-2 rounded-full" style={{ background: tagColor(tg) }} />
                            {tg}
                            {active ? <X className="size-3" /> : null}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  {trip.unscheduled.length === 0 ? (
                    <p className="py-3 text-center text-[12.5px] text-muted-foreground/70">
                      {t('Add places you want to go, then schedule them into a day.', '把想去的地點加進來，再排進某一天。')}
                    </p>
                  ) : canEdit && !wishlistFiltering && trip.unscheduled.length > 1 ? (
                    <SortableList
                      items={trip.unscheduled}
                      onReorder={(ids) => reorderItems.mutate({ dayId: null, itemIds: ids })}
                      className="space-y-1.5"
                      itemClassName="rounded-lg bg-background"
                      renderItem={(item, handle) => (
                        <ItemRow
                          item={item}
                          index={trip.unscheduled.findIndex((i) => i.id === item.id)}
                          count={trip.unscheduled.length}
                          canEdit={canEdit}
                          t={t}
                          dragHandle={handle}
                          scheduleDays={trip.days}
                          onSchedule={(dayId) => scheduleItem(item.id, dayId)}
                          onEdit={() => setItemDialog({ open: true, item, dayId: null })}
                          onDelete={() => removeItem(item)}
                          onMove={(dir) => moveItem(trip.unscheduled, null, trip.unscheduled.findIndex((i) => i.id === item.id), dir)}
                        />
                      )}
                    />
                  ) : shownUnscheduled.length ? (
                    <div className="space-y-1.5">
                      {trip.unscheduled.map((item, index) =>
                        (unschedCats.size === 0 || unschedCats.has(categoryOf(item.category))) &&
                        (!activeUnschedTag || item.tags?.includes(activeUnschedTag)) ? (
                          <ItemRow
                            key={item.id}
                            item={item}
                            index={index}
                            count={trip.unscheduled.length}
                            canEdit={canEdit}
                            t={t}
                            scheduleDays={trip.days}
                            onSchedule={(dayId) => scheduleItem(item.id, dayId)}
                            onEdit={() => setItemDialog({ open: true, item, dayId: null })}
                            onDelete={() => removeItem(item)}
                            onMove={(dir) => moveItem(trip.unscheduled, null, index, dir)}
                          />
                        ) : null,
                      )}
                    </div>
                  ) : (
                    <p className="py-3 text-center text-[12.5px] text-muted-foreground/70">
                      {t('No matches — try another filter.', '沒有符合的項目，換個篩選試試。')}
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* Cost rollup */}
          {costEntries.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
                {t('Estimated cost', '預估花費')}
              </span>
              {costEntries.map(([cur, total]) => (
                <span key={cur} className="rounded-full bg-brand-muted px-2.5 py-0.5 text-sm font-medium text-brand">
                  {fmtCost(total, cur === '?' ? null : cur)}
                </span>
              ))}
            </div>
          ) : null}

          {/* Filter + view switcher (Notion-style: timeline / table / board) */}
          <div className="flex items-center justify-end gap-2">
            <ItineraryFilter
              cats={catsPresent}
              hiddenCats={hiddenCats}
              setHiddenCats={setHiddenCats}
              hiddenStatuses={hiddenStatuses}
              setHiddenStatuses={setHiddenStatuses}
              t={t}
            />
            <div className="inline-flex gap-0.5 rounded-lg border border-border p-0.5">
              {(
                [
                  ['timeline', List, 'Timeline', '時間軸'],
                  ['table', Table2, 'Table', '表格'],
                  ['board', Columns3, 'Board', '看板'],
                ] as const
              ).map(([v, Icon, en, zh]) => (
                <button
                  key={v}
                  type="button"
                  title={t(en, zh)}
                  aria-label={t(en, zh)}
                  onClick={() => setView(v)}
                  className={`rounded-md p-1.5 transition ${view === v ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="size-4" />
                </button>
              ))}
            </div>
          </div>

          {view === 'timeline' ? (
            <>
          {/* Days */}
          {canEdit && !filtering && trip.days.length > 1 ? (
            <SortableList
              items={trip.days}
              onReorder={(ids) => reorderDays.mutate({ itineraryId: trip.id, dayIds: ids })}
              className="space-y-4"
              renderItem={(day, handle) => {
                const dayIndex = trip.days.findIndex((d) => d.id === day.id)
                return (
                  <DaySection
                    day={day}
                    dayIndex={dayIndex}
                    dayCount={trip.days.length}
                    canEdit={canEdit}
                    canDragItems={!filtering}
                    match={matchItem}
                    t={t}
                    dragHandle={handle}
                    onAddItem={() => setItemDialog({ open: true, dayId: day.id })}
                    onEditDay={() => setDayDialog({ open: true, day })}
                    onDeleteDay={() => removeDay(day)}
                    onMoveDay={(dir) => moveDay(dayIndex, dir)}
                    onEditItem={(item) => setItemDialog({ open: true, item, dayId: day.id })}
                    onDeleteItem={removeItem}
                    onMoveItem={(index, dir) => moveItem(day.items, day.id, index, dir)}
                    onReorderItems={(ids) => reorderItems.mutate({ dayId: day.id, itemIds: ids })}
                  />
                )
              }}
            />
          ) : (
            trip.days.map((day, dayIndex) => (
              <DaySection
                key={day.id}
                day={day}
                dayIndex={dayIndex}
                dayCount={trip.days.length}
                canEdit={canEdit}
                canDragItems={canEdit && !filtering}
                match={matchItem}
                t={t}
                onAddItem={() => setItemDialog({ open: true, dayId: day.id })}
                onEditDay={() => setDayDialog({ open: true, day })}
                onDeleteDay={() => removeDay(day)}
                onMoveDay={(dir) => moveDay(dayIndex, dir)}
                onEditItem={(item) => setItemDialog({ open: true, item, dayId: day.id })}
                onDeleteItem={removeItem}
                onMoveItem={(index, dir) => moveItem(day.items, day.id, index, dir)}
                onReorderItems={(ids) => reorderItems.mutate({ dayId: day.id, itemIds: ids })}
              />
            ))
          )}

          {/* Add day / empty hint */}
          {trip.days.length === 0 && trip.unscheduled.length === 0 ? (
            <EmptyState
              icon={<CalendarRange className="size-6" />}
              title={canEdit ? t('Start planning', '開始規劃') : t('Nothing planned yet', '還沒有任何規劃')}
              description={
                canEdit ? t('Add your first day, then fill it with activities.', '先新增第一天，再加入活動。') : undefined
              }
              action={
                canEdit ? (
                  <Button variant="brand" size="sm" onClick={() => setDayDialog({ open: true })}>
                    <CalendarPlus className="size-4" /> {t('Add day', '新增日期')}
                  </Button>
                ) : undefined
              }
            />
          ) : canEdit ? (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setDayDialog({ open: true })}>
              <CalendarPlus className="size-4" /> {t('Add day', '新增日期')}
            </Button>
          ) : null}
            </>
          ) : view === 'table' ? (
            <ItineraryTable trip={fTrip} canEdit={canEdit} onEdit={openItem} />
          ) : (
            <ItineraryBoard trip={fTrip} canEdit={canEdit} onEdit={openItem} />
          )}
            </>
          ) : null}
        </div>
      </div>

      <TripDialog open={tripDialog} onOpenChange={setTripDialog} trip={tripRow(trip)} />
      <ShareDialog open={shareDialog} onOpenChange={setShareDialog} itineraryId={trip.id} />
      <MembersDialog open={membersDialog} onOpenChange={setMembersDialog} itineraryId={trip.id} />
      <DayDialog
        open={dayDialog.open}
        onOpenChange={(v) => setDayDialog((s) => ({ ...s, open: v }))}
        itineraryId={trip.id}
        day={dayDialog.day}
      />
      <ItemDialog
        open={itemDialog.open}
        onOpenChange={(v) => setItemDialog((s) => ({ ...s, open: v }))}
        itineraryId={trip.id}
        days={trip.days}
        travelers={trip.travelers}
        tagSuggestions={allTags}
        defaultDayId={itemDialog.dayId}
        defaultCurrency={trip.default_currency}
        item={itemDialog.item}
      />
    </>
  )
}

// The TripDialog edits an ItineraryRow; the tree carries the same trip fields.
function tripRow(trip: ReturnType<typeof useItinerary>['data'] & {}) {
  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    timezone: trip.timezone,
    default_currency: trip.default_currency,
    cover_url: trip.cover_url,
    notes: trip.notes,
    travelers: trip.travelers,
    budget_total: trip.budget_total,
  } as Parameters<typeof TripDialog>[0]['trip']
}

type Tr = (en: string, zh: string) => string

function ItineraryFilter({
  cats,
  hiddenCats,
  setHiddenCats,
  hiddenStatuses,
  setHiddenStatuses,
  t,
}: {
  cats: Category[]
  hiddenCats: Set<Category>
  setHiddenCats: (s: Set<Category>) => void
  hiddenStatuses: Set<ItemStatus>
  setHiddenStatuses: (s: Set<ItemStatus>) => void
  t: Tr
}) {
  const active = hiddenCats.size > 0 || hiddenStatuses.size > 0
  const toggleCat = (c: Category) => {
    const n = new Set(hiddenCats)
    if (n.has(c)) n.delete(c)
    else n.add(c)
    setHiddenCats(n)
  }
  const toggleStatus = (s: ItemStatus) => {
    const n = new Set(hiddenStatuses)
    if (n.has(s)) n.delete(s)
    else n.add(s)
    setHiddenStatuses(n)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('Filter', '篩選')}
        className={`relative flex size-8 items-center justify-center rounded-lg border border-border transition hover:bg-accent ${active ? 'text-brand' : 'text-muted-foreground'}`}
      >
        <SlidersHorizontal className="size-4" />
        {active ? <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" /> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {t('Category', '分類')}
        </div>
        {cats.map((c) => {
          const meta = CATEGORY_META[c]
          const on = !hiddenCats.has(c)
          return (
            <DropdownMenuItem
              key={c}
              onSelect={(e) => {
                e.preventDefault()
                toggleCat(c)
              }}
            >
              <span className={`size-2 rounded-full ${meta.dot}`} />
              <span className="flex-1">{t(meta.en, meta.zh)}</span>
              {on ? <Check className="size-4 text-brand" /> : null}
            </DropdownMenuItem>
          )
        })}
        <DropdownMenuSeparator />
        <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
          {t('Status', '狀態')}
        </div>
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s]
          const on = !hiddenStatuses.has(s)
          return (
            <DropdownMenuItem
              key={s}
              onSelect={(e) => {
                e.preventDefault()
                toggleStatus(s)
              }}
            >
              <span className={`size-2 rounded-full ${meta.dot}`} />
              <span className="flex-1">{t(meta.en, meta.zh)}</span>
              {on ? <Check className="size-4 text-brand" /> : null}
            </DropdownMenuItem>
          )
        })}
        {active ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setHiddenCats(new Set())
                setHiddenStatuses(new Set())
              }}
            >
              {t('Show all', '顯示全部')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DaySection({
  day,
  dayIndex,
  dayCount,
  canEdit,
  canDragItems,
  dragHandle,
  match,
  t,
  onAddItem,
  onEditDay,
  onDeleteDay,
  onMoveDay,
  onEditItem,
  onDeleteItem,
  onMoveItem,
  onReorderItems,
}: {
  day: ItineraryDay
  dayIndex: number
  dayCount: number
  canEdit: boolean
  canDragItems: boolean
  dragHandle?: ReactNode
  match: (item: ItineraryItem) => boolean
  t: Tr
  onAddItem: () => void
  onEditDay: () => void
  onDeleteDay: () => void
  onMoveDay: (dir: -1 | 1) => void
  onEditItem: (item: ItineraryItem) => void
  onReorderItems: (ids: string[]) => void
  onDeleteItem: (item: ItineraryItem) => void
  onMoveItem: (index: number, dir: -1 | 1) => void
}) {
  // Day headers read as humans say them — 「6月14日(週六)」, not raw ISO (QW7).
  const { lang } = useI18n()
  const heading = day.label || (day.day_date ? fmtDayDate(day.day_date, lang) : t(`Day ${dayIndex + 1}`, `第 ${dayIndex + 1} 天`))
  const sub = day.label && day.day_date ? fmtDayDate(day.day_date, lang) : null
  const costByCur: Record<string, number> = {}
  day.items.forEach((i) => {
    if (i.cost != null) costByCur[i.currency || '?'] = (costByCur[i.currency || '?'] ?? 0) + Number(i.cost)
  })
  const costStr = Object.entries(costByCur)
    .map(([c, v]) => fmtCost(v, c === '?' ? null : c))
    .join(' · ')
  const rollup = `${day.items.length} ${t('stops', '站')}${costStr ? ' · ' + costStr : ''}`
  return (
    <section className="rounded-xl border border-border bg-card shadow-soft">
      <div className="group flex items-center gap-2.5 border-b border-border px-3 py-2.5 sm:px-4">
        {dragHandle}
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-muted text-[11px] font-semibold text-brand">
          {dayIndex + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base font-semibold text-foreground">{heading}</p>
          {sub ? <p className="truncate text-[11px] text-muted-foreground">{sub}</p> : null}
        </div>
        {day.items.length ? (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{rollup}</span>
        ) : null}
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('More', '更多')}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-accent hover:text-foreground data-[state=open]:bg-accent"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onAddItem}>
                <Plus /> {t('Add activity', '新增活動')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEditDay}>
                <Pencil /> {t('Edit day', '編輯日期')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMoveDay(-1)} disabled={dayIndex === 0}>
                <ChevronUp /> {t('Move up', '上移')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMoveDay(1)} disabled={dayIndex === dayCount - 1}>
                <ChevronDown /> {t('Move down', '下移')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDeleteDay} className="text-destructive focus:text-destructive">
                <Trash2 /> {t('Remove day', '移除日期')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="space-y-1.5 p-2 sm:p-2.5">
        {day.items.length === 0 ? (
          <p className="px-2 py-3 text-center text-[12.5px] text-muted-foreground/70">
            {t('No activities yet.', '還沒有活動。')}
          </p>
        ) : canDragItems ? (
          <SortableList
            items={day.items}
            onReorder={onReorderItems}
            className="space-y-1.5"
            itemClassName="rounded-lg bg-card"
            renderItem={(item, handle) => (
              <ItemRow
                item={item}
                index={day.items.findIndex((i) => i.id === item.id)}
                count={day.items.length}
                canEdit={canEdit}
                t={t}
                dragHandle={handle}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
                onMove={(dir) => onMoveItem(day.items.findIndex((i) => i.id === item.id), dir)}
              />
            )}
          />
        ) : day.items.some(match) ? (
          // Render only matching items, but keep the FULL index so reorder is correct.
          day.items.map((item, index) =>
            match(item) ? (
              <ItemRow
                key={item.id}
                item={item}
                index={index}
                count={day.items.length}
                canEdit={canEdit}
                t={t}
                onEdit={() => onEditItem(item)}
                onDelete={() => onDeleteItem(item)}
                onMove={(dir) => onMoveItem(index, dir)}
              />
            ) : null,
          )
        ) : (
          <p className="px-2 py-3 text-center text-[12.5px] text-muted-foreground/60">
            {t('Nothing matches the filter.', '沒有符合篩選的項目。')}
          </p>
        )}
        {canEdit ? (
          <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={onAddItem}>
            <Plus className="size-4" /> {t('Add activity', '新增活動')}
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function ItemRow({
  item,
  index,
  count,
  canEdit,
  t,
  onEdit,
  onDelete,
  onMove,
  dragHandle,
  scheduleDays,
  onSchedule,
}: {
  item: ItineraryItem
  index: number
  count: number
  canEdit: boolean
  t: Tr
  onEdit: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  dragHandle?: ReactNode
  /** When provided (wishlist context), shows a quick "schedule into a day" picker. */
  scheduleDays?: ItineraryDay[]
  onSchedule?: (dayId: string) => void
}) {
  const cat = CATEGORY_META[categoryOf(item.category)]
  const st = STATUS_META[statusOf(item.status)]
  const status = statusOf(item.status)
  const time = fmtTimeRange(item.start_time, item.end_time, item.end_day_offset)
  const maps = mapsUrl(item.place, item.lat, item.lng)
  const booking = safeHttps(item.booking_url)
  const cost = fmtCost(item.cost, item.currency)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div
      className="group relative flex gap-3 rounded-lg border border-transparent py-2.5 pl-4 pr-2 transition hover:border-border hover:bg-background sm:gap-4"
      onClick={canEdit ? onEdit : undefined}
      role={canEdit ? 'button' : undefined}
    >
      {/* Category rail — the only category signifier */}
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full ${cat.dot}`}
      />

      {dragHandle ? <div className="-ml-2 flex shrink-0 items-center self-center">{dragHandle}</div> : null}

      {/* COLUMN 1 · time / place / people / labels (same two-column logic on mobile) */}
      <div className="w-[5.5rem] shrink-0 space-y-1 sm:w-44">
        <div className="font-mono text-[13px] font-semibold tabular-nums text-foreground">{time || '—'}</div>
        {item.place ? (
          maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-0.5 text-[12px] text-muted-foreground transition hover:text-brand"
            >
              <span className="truncate">{item.place}</span>
              <ArrowUpRight className="size-3 shrink-0 opacity-60" />
            </a>
          ) : (
            <div className="truncate text-[12px] text-muted-foreground">{item.place}</div>
          )
        ) : null}
        {item.assignees?.length ? (
          <div className="truncate text-[12px] text-muted-foreground">{item.assignees.join(' · ')}</div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${cat.text}`}>{t(cat.en, cat.zh)}</span>
          {status !== 'planned' ? (
            <span className={`text-[11px] font-medium ${st.text}`}>{t(st.en, st.zh)}</span>
          ) : null}
          {cost ? <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{cost}</span> : null}
        </div>
      </div>

      {/* COLUMN 2 · title (dominant) + description */}
      <div className="min-w-0 flex-1 pr-7">
        <h4 className="text-[16px] font-semibold leading-snug text-foreground sm:text-[18px]">{item.title}</h4>
        {item.tags?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((tg) => (
              <span
                key={tg}
                style={tagChipStyle(tg, isDark)}
                className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
              >
                {tg}
              </span>
            ))}
          </div>
        ) : null}
        {item.transport_detail ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{item.transport_detail}</p>
        ) : null}
        {item.notes ? (
          <p
            title={item.notes}
            className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground/80"
          >
            {item.notes}
          </p>
        ) : null}
        {booking ? (
          <a
            href={booking}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-1 inline-flex items-center gap-0.5 text-[12px] text-muted-foreground transition hover:text-brand"
          >
            {t('Booking', '訂購')}
            <ArrowUpRight className="size-3 opacity-60" />
          </a>
        ) : null}
      </div>

      {/* Actions · quick schedule (wishlist) + overflow menu, calm at rest */}
      {canEdit ? (
        <div
          className={cn(
            'absolute right-1 top-1.5 flex items-center gap-0.5 transition',
            // The wishlist "排入" affordance stays visible; the bare overflow menu rests until hover.
            onSchedule
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {scheduleDays && onSchedule ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('Schedule into a day', '排入某天')}
                title={t('Schedule into a day', '排入某天')}
                className="flex h-7 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-muted-foreground/80 transition hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
              >
                <CalendarDays className="size-4" /> <span className="hidden sm:inline">{t('Schedule', '排入')}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {scheduleDays.length ? (
                  scheduleDays.map((d, i) => (
                    <DropdownMenuItem key={d.id} onSelect={() => onSchedule(d.id)}>
                      <CalendarDays /> {d.label || d.day_date || t(`Day ${i + 1}`, `第 ${i + 1} 天`)}
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>{t('Add a day first', '請先新增日期')}</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t('More', '更多')}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground/70 transition hover:bg-accent hover:text-foreground data-[state=open]:bg-accent data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> {t('Edit', '編輯')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove(-1)} disabled={index === 0}>
                <ChevronUp /> {t('Move up', '上移')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onMove(1)} disabled={index === count - 1}>
                <ChevronDown /> {t('Move down', '下移')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 /> {t('Delete', '刪除')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  )
}

