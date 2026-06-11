import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import {
  Bed,
  Bus,
  Car,
  ExternalLink,
  Pencil,
  Plane,
  Plus,
  Ticket,
  Trash2,
  Package,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateBooking,
  useCreateChecklistItem,
  useDeleteBooking,
  useDeleteChecklistItem,
  useUpdateBooking,
  useUpdateChecklistItem,
} from '@/lib/hooks'
import type { ChecklistItem, ItineraryTree, TripBooking } from '@/lib/api'
import { categoryOf, CATEGORY_META, fmtCost, safeHttps } from '@/lib/itinerary'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type BookingType = TripBooking['type']

const BTYPE: Record<BookingType, { icon: typeof Plane; en: string; zh: string }> = {
  flight: { icon: Plane, en: 'Flight', zh: '機票' },
  lodging: { icon: Bed, en: 'Lodging', zh: '住宿' },
  transport: { icon: Bus, en: 'Transport', zh: '交通' },
  ticket: { icon: Ticket, en: 'Ticket', zh: '票券' },
  car: { icon: Car, en: 'Car', zh: '租車' },
  other: { icon: Package, en: 'Other', zh: '其他' },
}
const BTYPES = Object.keys(BTYPE) as BookingType[]

function fmtDT(iso: string | null): string {
  if (!iso) return ''
  const s = iso.replace('T', ' ')
  return s.slice(5, 16) // MM-DD HH:MM
}
function toLocalInput(iso: string | null): string {
  return iso ? iso.slice(0, 16) : ''
}

// ─────────────────────────────── Reservations ───────────────────────────────
export function BookingsTab({ trip, canEdit }: { trip: ItineraryTree; canEdit: boolean }) {
  const t = useT()
  const del = useDeleteBooking()
  const [dialog, setDialog] = useState<{ open: boolean; booking?: TripBooking }>({ open: false })

  if (!trip.bookings.length && !canEdit) {
    return <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">{t('No reservations.', '沒有訂位。')}</p>
  }

  return (
    <div className="space-y-2">
      {trip.bookings.map((b) => {
        const meta = BTYPE[b.type]
        const Icon = meta.icon
        const url = safeHttps(b.url)
        const when = [fmtDT(b.start_at), fmtDT(b.end_at)].filter(Boolean).join(' → ')
        const route = [b.from_label, b.to_label].filter(Boolean).join(' → ') || b.location
        return (
          <div key={b.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-muted text-brand">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium text-foreground">{b.title}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(meta.en, meta.zh)}</span>
                {b.cost != null ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {fmtCost(b.cost, b.currency)}
                  </span>
                ) : null}
              </div>
              {when ? <p className="font-mono text-[12px] text-muted-foreground">{when}</p> : null}
              {route ? <p className="text-[12.5px] text-muted-foreground">{route}</p> : null}
              {b.confirmation ? (
                <p className="text-[12px] text-muted-foreground">{t('Conf.', '訂位編號')} {b.confirmation}</p>
              ) : null}
              {b.notes ? <p className="whitespace-pre-wrap text-[12.5px] text-muted-foreground">{b.notes}</p> : null}
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition hover:text-brand"
                >
                  <ExternalLink className="size-3" /> {t('Open', '開啟')}
                </a>
              ) : null}
            </div>
            {canEdit ? (
              <div className="flex shrink-0 items-center gap-0.5 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setDialog({ open: true, booking: b })}
                  className="rounded p-1 transition hover:bg-accent hover:text-foreground"
                  title={t('Edit', '編輯')}
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => del.mutate(b.id)}
                  className="rounded p-1 transition hover:bg-accent hover:text-destructive"
                  title={t('Delete', '刪除')}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ) : null}
          </div>
        )
      })}
      {canEdit ? (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setDialog({ open: true })}>
          <Plus className="size-4" /> {t('Add reservation', '新增訂位')}
        </Button>
      ) : null}
      <BookingDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((s) => ({ ...s, open: v }))}
        itineraryId={trip.id}
        defaultCurrency={trip.default_currency}
        booking={dialog.booking}
      />
    </div>
  )
}

function BookingDialog({
  open,
  onOpenChange,
  itineraryId,
  defaultCurrency,
  booking,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  itineraryId: string
  defaultCurrency?: string | null
  booking?: TripBooking
}) {
  const t = useT()
  const create = useCreateBooking()
  const update = useUpdateBooking()
  const editing = !!booking
  const [type, setType] = useState<BookingType>('flight')
  const [title, setTitle] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [location, setLocation] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState('')
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    setType(booking?.type ?? 'flight')
    setTitle(booking?.title ?? '')
    setStartAt(toLocalInput(booking?.start_at ?? null))
    setEndAt(toLocalInput(booking?.end_at ?? null))
    setFrom(booking?.from_label ?? '')
    setTo(booking?.to_label ?? '')
    setLocation(booking?.location ?? '')
    setConfirmation(booking?.confirmation ?? '')
    setCost(booking?.cost != null ? String(booking.cost) : '')
    setCurrency(booking?.currency ?? defaultCurrency ?? '')
    setUrl(booking?.url ?? '')
    setNotes(booking?.notes ?? '')
  }, [open, booking, defaultCurrency])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const costNum = cost.trim() === '' ? undefined : Number(cost)
    const fields = {
      type,
      title: title.trim(),
      start_at: startAt || undefined,
      end_at: endAt || undefined,
      from_label: from.trim() || undefined,
      to_label: to.trim() || undefined,
      location: location.trim() || undefined,
      confirmation: confirmation.trim() || undefined,
      cost: costNum != null && !Number.isNaN(costNum) ? costNum : undefined,
      currency: currency.trim() || undefined,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      if (editing && booking) await update.mutateAsync({ booking_id: booking.id, ...fields })
      else await create.mutateAsync({ itinerary_id: itineraryId, ...fields })
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
    }
  }

  const routey = type === 'flight' || type === 'transport'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit reservation', '編輯訂位') : t('Add reservation', '新增訂位')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-type">{t('Type', '類型')}</Label>
              <Select id="bk-type" value={type} onChange={(e) => setType(e.target.value as BookingType)}>
                {BTYPES.map((v) => (
                  <option key={v} value={v}>
                    {t(BTYPE[v].en, BTYPE[v].zh)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-title">{t('Title', '標題')}</Label>
              <Input id="bk-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="JL802 / Hotel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-start">{t('Start', '開始')}</Label>
              <Input id="bk-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-end">{t('End', '結束')}</Label>
              <Input id="bk-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          {routey ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bk-from">{t('From', '出發')}</Label>
                <Input id="bk-from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="TPE" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bk-to">{t('To', '抵達')}</Label>
                <Input id="bk-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="CJU" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-loc">{t('Location', '地點')}</Label>
              <Input id="bk-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          )}
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-cost">{t('Cost', '費用')}</Label>
              <Input id="bk-cost" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bk-cur">{t('Cur.', '幣別')}</Label>
              <Input id="bk-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-conf">{t('Confirmation #', '訂位編號')}</Label>
            <Input id="bk-conf" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-url">{t('Link', '連結')}</Label>
            <Input id="bk-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bk-notes">{t('Notes', '備註')}</Label>
            <Textarea id="bk-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={create.isPending || update.isPending || !title.trim()}>
              {t('Save', '儲存')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────── Budget ───────────────────────────────────
export function BudgetTab({ trip }: { trip: ItineraryTree }) {
  const t = useT()
  const entries = Object.entries(trip.cost_by_currency ?? {})
  // Category breakdown (items by category + bookings by type), in any currency.
  const byCat = new Map<string, number>()
  trip.days.forEach((d) => d.items.forEach((i) => i.cost != null && byCat.set(i.category, (byCat.get(i.category) ?? 0) + Number(i.cost))))
  trip.unscheduled.forEach((i) => i.cost != null && byCat.set(i.category, (byCat.get(i.category) ?? 0) + Number(i.cost)))
  trip.bookings.forEach((b) => b.cost != null && byCat.set(b.type, (byCat.get(b.type) ?? 0) + Number(b.cost)))
  const cats = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])

  if (!entries.length && trip.budget_total == null) {
    return (
      <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
        {t('Add costs to activities or reservations to see a budget.', '在活動或訂位填入費用就會出現預算總覽。')}
      </p>
    )
  }
  const mainCur = trip.default_currency
  const mainSpent = trip.cost_by_currency?.[mainCur] ?? 0

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {entries.map(([cur, total]) => (
            <div key={cur}>
              <span className="text-lg font-semibold text-foreground">{fmtCost(total, cur === '?' ? null : cur)}</span>
            </div>
          ))}
          {!entries.length ? <span className="text-sm text-muted-foreground">{t('No costs yet', '尚無費用')}</span> : null}
        </div>
        {trip.budget_total != null ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[12px] text-muted-foreground">
              <span>{t('Spent / budget', '已估 / 預算')} ({mainCur})</span>
              <span className="tabular-nums">
                {fmtCost(mainSpent, mainCur)} / {fmtCost(trip.budget_total, mainCur)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${mainSpent > trip.budget_total ? 'bg-destructive' : 'bg-brand'}`}
                style={{ width: `${Math.min(100, trip.budget_total ? (mainSpent / trip.budget_total) * 100 : 0)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      {cats.length ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t('By category', '依分類')}
          </p>
          <div className="space-y-1.5">
            {cats.map(([cat, total]) => {
              const meta = CATEGORY_META[categoryOf(cat)]
              return (
                <div key={cat} className="flex items-center gap-2 text-sm">
                  <span className={`size-2 rounded-full ${meta.dot}`} />
                  <span className="flex-1 text-muted-foreground">{t(meta.en, meta.zh)}</span>
                  <span className="tabular-nums text-foreground">{total.toLocaleString('en-US')}</span>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ────────────────────────────── Packing & To-dos ──────────────────────────────
export function PackingTab({ trip, canEdit }: { trip: ItineraryTree; canEdit: boolean }) {
  const t = useT()
  const create = useCreateChecklistItem()
  const toggle = useUpdateChecklistItem()
  const del = useDeleteChecklistItem()
  const groups: { kind: 'packing' | 'todo'; en: string; zh: string }[] = [
    { kind: 'todo', en: 'To-dos', zh: '待辦' },
    { kind: 'packing', en: 'Packing', zh: '打包' },
  ]
  const [draft, setDraft] = useState<Record<string, string>>({})

  async function add(kind: 'packing' | 'todo') {
    const text = (draft[kind] ?? '').trim()
    if (!text) return
    try {
      await create.mutateAsync({ itinerary_id: trip.id, kind, text })
      setDraft((d) => ({ ...d, [kind]: '' }))
    } catch (err) {
      toast.error(humanizeError(err, ['Failed', '失敗']))
    }
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const items = trip.checklist.filter((c) => c.kind === g.kind)
        return (
          <section key={g.kind} className="space-y-1.5">
            <h3 className="px-1 text-sm font-semibold text-foreground">
              {t(g.en, g.zh)}{' '}
              {items.length ? (
                <span className="text-muted-foreground">
                  · {items.filter((i) => i.done).length}/{items.length}
                </span>
              ) : null}
            </h3>
            <div className="rounded-xl border border-border bg-card shadow-soft">
              {items.length ? (
                items.map((c: ChecklistItem) => (
                  <div key={c.id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-0">
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => toggle.mutate({ item_id: c.id, done: !c.done })}
                      className={`flex size-5 shrink-0 items-center justify-center rounded border transition ${c.done ? 'border-brand bg-brand text-brand-foreground' : 'border-input'}`}
                    >
                      {c.done ? <Check className="size-3.5" /> : null}
                    </button>
                    <span className={`flex-1 text-sm ${c.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {c.text}
                      {c.assignee ? <span className="ml-2 text-[11px] text-muted-foreground">· {c.assignee}</span> : null}
                    </span>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => del.mutate(c.id)}
                        className="rounded p-1 text-muted-foreground transition hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="px-3 py-3 text-center text-[12.5px] text-muted-foreground/70">{t('Nothing yet.', '還沒有項目。')}</p>
              )}
              {canEdit ? (
                <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
                  <Input
                    value={draft[g.kind] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [g.kind]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        void add(g.kind)
                      }
                    }}
                    placeholder={g.kind === 'packing' ? t('Add packing item…', '新增打包項目…') : t('Add to-do…', '新增待辦…')}
                    className="h-8 flex-1"
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => add(g.kind)}>
                    <Plus className="size-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        )
      })}
    </div>
  )
}
