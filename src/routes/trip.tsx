import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  CalendarPlus,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Users,
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
import { Button } from '@/components/ui/button'
import { CATEGORY_META, categoryOf, fmtCost, fmtDateRange, fmtTimeRange, mapsUrl, safeHttps } from '@/lib/itinerary'
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
  return (
    <section className="rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-muted text-[11px] font-semibold text-brand">
          {dayIndex + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{heading}</p>
          {sub ? <p className="truncate text-[11px] text-muted-foreground">{sub}</p> : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
            <IconBtn label={t('Move up', '上移')} disabled={dayIndex === 0} onClick={() => onMoveDay(-1)}>
              <ChevronUp className="size-3.5" />
            </IconBtn>
            <IconBtn label={t('Move down', '下移')} disabled={dayIndex === dayCount - 1} onClick={() => onMoveDay(1)}>
              <ChevronDown className="size-3.5" />
            </IconBtn>
            <IconBtn label={t('Edit day', '編輯日期')} onClick={onEditDay}>
              <Pencil className="size-3.5" />
            </IconBtn>
            <IconBtn label={t('Remove day', '移除日期')} onClick={onDeleteDay}>
              <Trash2 className="size-3.5" />
            </IconBtn>
          </div>
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
  const Icon = cat.icon
  const time = fmtTimeRange(item.start_time, item.end_time, item.end_day_offset)
  const maps = mapsUrl(item.place, item.lat, item.lng)
  const booking = safeHttps(item.booking_url)
  const cost = fmtCost(item.cost, item.currency)

  return (
    <div className="group flex items-start gap-2.5 rounded-lg border border-transparent px-2 py-2 transition hover:border-border hover:bg-background">
      <span className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-md border ${cat.chip}`}>
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          {time ? <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{time}</span> : null}
          <span className="text-sm font-medium text-foreground">{item.title}</span>
          {cost ? (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{cost}</span>
          ) : null}
        </div>
        {item.transport_detail ? (
          <p className="text-[12px] text-muted-foreground">{item.transport_detail}</p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px]">
          {maps ? (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-brand"
            >
              <MapPin className="size-3" /> {item.place || t('Map', '地圖')}
            </a>
          ) : item.place ? (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <MapPin className="size-3" /> {item.place}
            </span>
          ) : null}
          {booking ? (
            <a
              href={booking}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground transition hover:text-brand"
            >
              <ExternalLink className="size-3" /> {t('Booking', '訂購')}
            </a>
          ) : null}
        </div>
        {item.notes ? <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-muted-foreground">{item.notes}</p> : null}
      </div>
      {canEdit ? (
        <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
          <IconBtn label={t('Move up', '上移')} disabled={index === 0} onClick={() => onMove(-1)}>
            <ChevronUp className="size-3.5" />
          </IconBtn>
          <IconBtn label={t('Move down', '下移')} disabled={index === count - 1} onClick={() => onMove(1)}>
            <ChevronDown className="size-3.5" />
          </IconBtn>
          <IconBtn label={t('Edit', '編輯')} onClick={onEdit}>
            <Pencil className="size-3.5" />
          </IconBtn>
          <IconBtn label={t('Delete', '刪除')} onClick={onDelete}>
            <Trash2 className="size-3.5" />
          </IconBtn>
        </div>
      ) : null}
    </div>
  )
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 transition hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
