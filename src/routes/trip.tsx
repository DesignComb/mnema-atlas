import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Columns3,
  List,
  Luggage,
  MoreHorizontal,
  Pencil,
  Plus,
  Share2,
  Table2,
  Ticket,
  Trash2,
  Users,
  Wallet,
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
} from '@/lib/hooks'
import type { ItineraryDay, ItineraryItem } from '@/lib/api'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { TripDialog } from '@/components/trips/TripDialog'
import { DayDialog } from '@/components/trips/DayDialog'
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
  CATEGORY_META,
  STATUS_META,
  categoryOf,
  fmtCost,
  fmtDateRange,
  fmtTimeRange,
  mapsUrl,
  safeHttps,
  statusOf,
} from '@/lib/itinerary'
import { useT } from '@/lib/i18n'

export function TripScreen() {
  const { tripId } = useParams({ strict: false }) as { tripId: string }
  const { data: trip, isLoading, isError } = useItinerary(tripId)
  const deleteTrip = useDeleteItinerary()
  const deleteDay = useDeleteDay()
  const deleteItem = useDeleteItem()
  const reorderDays = useReorderDays()
  const reorderItems = useReorderItems()
  const navigate = useNavigate()
  const t = useT()
  useItineraryRealtime(tripId)

  const [tab, setTab] = useState<TripTab>('itinerary')
  const [view, setView] = useState<ItinView>('timeline')
  const [tripDialog, setTripDialog] = useState(false)
  const [shareDialog, setShareDialog] = useState(false)
  const [membersDialog, setMembersDialog] = useState(false)
  const [dayDialog, setDayDialog] = useState<{ open: boolean; day?: ItineraryDay }>({ open: false })
  const [itemDialog, setItemDialog] = useState<{ open: boolean; item?: ItineraryItem; dayId?: string | null }>({
    open: false,
  })
  const [confirmDel, setConfirmDel] = useState(false)

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
      toast.error(err instanceof Error ? err.message : t('Failed to delete trip', '刪除行程失敗'))
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
      toast.error(err instanceof Error ? err.message : t('Failed to remove day', '移除日期失敗'))
    }
  }

  async function removeItem(item: ItineraryItem) {
    try {
      await deleteItem.mutateAsync(item.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to delete activity', '刪除活動失敗'))
    }
  }

  const openItem = (item: ItineraryItem) => setItemDialog({ open: true, item, dayId: item.day_id })

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('Trip', '行程')} icon={<MapIcon className="size-4" />} />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-3">
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
              <Button variant="ghost" size="sm" onClick={() => setMembersDialog(true)} title={t('Collaborators', '協作者')}>
                <Users className="size-4" />
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
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6 sm:py-6">
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

          {/* Section nav (underline) */}
          <div className="flex items-center gap-0.5 overflow-x-auto border-b border-border">
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

          {/* View switcher (Notion-style: timeline / table / board) */}
          <div className="flex justify-end">
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
          {trip.days.map((day, dayIndex) => (
            <DaySection
              key={day.id}
              day={day}
              dayIndex={dayIndex}
              dayCount={trip.days.length}
              canEdit={canEdit}
              t={t}
              onAddItem={() => setItemDialog({ open: true, dayId: day.id })}
              onEditDay={() => setDayDialog({ open: true, day })}
              onDeleteDay={() => removeDay(day)}
              onMoveDay={(dir) => moveDay(dayIndex, dir)}
              onEditItem={(item) => setItemDialog({ open: true, item, dayId: day.id })}
              onDeleteItem={removeItem}
              onMoveItem={(index, dir) => moveItem(day.items, day.id, index, dir)}
            />
          ))}

          {/* Unscheduled bucket */}
          {trip.unscheduled.length ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold text-muted-foreground">{t('Unscheduled', '未排程')}</h3>
                {canEdit ? (
                  <Button variant="ghost" size="sm" onClick={() => setItemDialog({ open: true, dayId: null })}>
                    <Plus className="size-4" /> {t('Idea', '想去')}
                  </Button>
                ) : null}
              </div>
              <div className="space-y-1.5">
                {trip.unscheduled.map((item, index) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    index={index}
                    count={trip.unscheduled.length}
                    canEdit={canEdit}
                    t={t}
                    onEdit={() => setItemDialog({ open: true, item, dayId: null })}
                    onDelete={() => removeItem(item)}
                    onMove={(dir) => moveItem(trip.unscheduled, null, index, dir)}
                  />
                ))}
              </div>
            </section>
          ) : null}

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
            <ItineraryTable trip={trip} canEdit={canEdit} onEdit={openItem} />
          ) : (
            <ItineraryBoard trip={trip} canEdit={canEdit} onEdit={openItem} />
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

function DaySection({
  day,
  dayIndex,
  dayCount,
  canEdit,
  t,
  onAddItem,
  onEditDay,
  onDeleteDay,
  onMoveDay,
  onEditItem,
  onDeleteItem,
  onMoveItem,
}: {
  day: ItineraryDay
  dayIndex: number
  dayCount: number
  canEdit: boolean
  t: Tr
  onAddItem: () => void
  onEditDay: () => void
  onDeleteDay: () => void
  onMoveDay: (dir: -1 | 1) => void
  onEditItem: (item: ItineraryItem) => void
  onDeleteItem: (item: ItineraryItem) => void
  onMoveItem: (index: number, dir: -1 | 1) => void
}) {
  const heading = day.label || day.day_date || t(`Day ${dayIndex + 1}`, `第 ${dayIndex + 1} 天`)
  const sub = day.label && day.day_date ? day.day_date : null
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
      <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 sm:px-4">
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
        {day.items.length ? (
          day.items.map((item, index) => (
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
          ))
        ) : (
          <p className="px-2 py-3 text-center text-[12.5px] text-muted-foreground/70">
            {t('No activities yet.', '還沒有活動。')}
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
}: {
  item: ItineraryItem
  index: number
  count: number
  canEdit: boolean
  t: Tr
  onEdit: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const cat = CATEGORY_META[categoryOf(item.category)]
  const st = STATUS_META[statusOf(item.status)]
  const status = statusOf(item.status)
  const time = fmtTimeRange(item.start_time, item.end_time, item.end_day_offset)
  const maps = mapsUrl(item.place, item.lat, item.lng)
  const booking = safeHttps(item.booking_url)
  const cost = fmtCost(item.cost, item.currency)
  const hasMeta = Boolean(item.place || cost || item.transport_detail || item.assignees?.length || booking)

  return (
    <div
      className="group relative rounded-lg border border-transparent py-2.5 pl-4 pr-2 transition hover:border-border hover:bg-background"
      onClick={canEdit ? onEdit : undefined}
      role={canEdit ? 'button' : undefined}
    >
      {/* Category rail — the only category signifier */}
      <span
        aria-hidden
        className={`pointer-events-none absolute bottom-1.5 left-0 top-1.5 w-[3px] rounded-full ${cat.dot}`}
      />

      {/* Tier 1 · time */}
      <div className="font-mono text-[12px] font-semibold tabular-nums text-muted-foreground">{time || '—'}</div>

      {/* Tier 2 · title (dominant) + bare status word */}
      <div className="mt-0.5 flex items-baseline justify-between gap-3 pr-7">
        <h4 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-foreground sm:text-base">
          {item.title}
        </h4>
        {status !== 'planned' ? (
          <span className={`shrink-0 text-[11px] font-medium ${st.text}`}>{t(st.en, st.zh)}</span>
        ) : null}
      </div>

      {/* Tier 3 · meta (category word leads; no per-field icons) */}
      {hasMeta ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-foreground">
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${cat.text}`}>{t(cat.en, cat.zh)}</span>
          {item.place ? (
            maps ? (
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex max-w-[65%] items-center gap-0.5 truncate font-medium text-foreground/80 transition hover:text-brand"
              >
                {item.place}
                <ArrowUpRight className="size-3 shrink-0 opacity-60" />
              </a>
            ) : (
              <span className="max-w-[65%] truncate font-medium text-foreground/80">{item.place}</span>
            )
          ) : null}
          {item.transport_detail ? <span>{item.transport_detail}</span> : null}
          {cost ? <span className="font-mono font-medium tabular-nums text-foreground/80">{cost}</span> : null}
          {item.assignees?.length ? <span>{item.assignees.join(' · ')}</span> : null}
          {booking ? (
            <a
              href={booking}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 transition hover:text-brand"
            >
              {t('Booking', '訂購')}
              <ArrowUpRight className="size-3 opacity-60" />
            </a>
          ) : null}
        </div>
      ) : null}

      {/* Tier 4 · notes (dimmest, clamped) */}
      {item.notes ? (
        <p
          title={item.notes}
          className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-muted-foreground/70"
        >
          {item.notes}
        </p>
      ) : null}

      {/* Actions · single overflow menu, calm at rest */}
      {canEdit ? (
        <div
          className="absolute right-1 top-1.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
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

