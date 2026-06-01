import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateItem, useSetItemDay, useUpdateItem } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { CATEGORIES, CATEGORY_META, categoryOf, type Category } from '@/lib/itinerary'
import type { ItineraryDay, ItineraryItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const UNSCHEDULED = 'unscheduled'
const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40'

function dayOptionLabel(day: ItineraryDay, index: number, t: (en: string, zh: string) => string): string {
  return day.label || day.day_date || t(`Day ${index + 1}`, `第 ${index + 1} 天`)
}

export function ItemDialog({
  open,
  onOpenChange,
  itineraryId,
  days,
  defaultDayId,
  defaultCurrency,
  item,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  itineraryId: string
  days: ItineraryDay[]
  /** Preselected day when adding (null/undefined → unscheduled). */
  defaultDayId?: string | null
  defaultCurrency?: string | null
  /** When provided, edits this activity instead of adding one. */
  item?: ItineraryItem
}) {
  const editing = !!item
  const t = useT()
  const create = useCreateItem()
  const update = useUpdateItem()
  const setItemDay = useSetItemDay()

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Category>('sight')
  const [place, setPlace] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [cost, setCost] = useState('')
  const [currency, setCurrency] = useState('')
  const [transportMode, setTransportMode] = useState('')
  const [transportDetail, setTransportDetail] = useState('')
  const [bookingUrl, setBookingUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [dayId, setDayId] = useState<string>(UNSCHEDULED)

  useEffect(() => {
    if (!open) return
    setTitle(item?.title ?? '')
    setCategory(categoryOf(item?.category))
    setPlace(item?.place ?? '')
    setStartTime(item?.start_time?.slice(0, 5) ?? '')
    setEndTime(item?.end_time?.slice(0, 5) ?? '')
    setCost(item?.cost != null ? String(item.cost) : '')
    setCurrency(item?.currency ?? defaultCurrency ?? '')
    setTransportMode(item?.transport_mode ?? '')
    setTransportDetail(item?.transport_detail ?? '')
    setBookingUrl(item?.booking_url ?? '')
    setNotes(item?.notes ?? '')
    setDayId(item ? (item.day_id ?? UNSCHEDULED) : (defaultDayId ?? UNSCHEDULED))
  }, [open, item, defaultDayId, defaultCurrency])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const costNum = cost.trim() === '' ? undefined : Number(cost)
    if (costNum != null && Number.isNaN(costNum)) {
      toast.error(t('Cost must be a number', '花費必須是數字'))
      return
    }
    const fields = {
      title: title.trim(),
      category,
      place: place.trim() || undefined,
      start_time: startTime || undefined,
      end_time: endTime || undefined,
      cost: costNum,
      currency: currency.trim() || undefined,
      transport_mode: transportMode.trim() || undefined,
      transport_detail: transportDetail.trim() || undefined,
      booking_url: bookingUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      if (editing && item) {
        await update.mutateAsync({ item_id: item.id, ...fields, expected_updated_at: undefined })
        const nextDay = dayId === UNSCHEDULED ? null : dayId
        if (nextDay !== (item.day_id ?? null)) {
          await setItemDay.mutateAsync({ itemId: item.id, dayId: nextDay })
        }
      } else if (dayId === UNSCHEDULED) {
        await create.mutateAsync({ itinerary_id: itineraryId, ...fields })
      } else {
        await create.mutateAsync({ day_id: dayId, ...fields })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save activity', '儲存活動失敗'))
    }
  }

  const pending = create.isPending || update.isPending || setItemDay.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit activity', '編輯活動') : t('Add activity', '新增活動')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-title">{t('Title', '標題')}</Label>
            <Input
              id="item-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('e.g. Kiyomizu-dera', '例如：清水寺')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-cat">{t('Category', '分類')}</Label>
              <select
                id="item-cat"
                className={selectClass}
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {t(CATEGORY_META[c].en, CATEGORY_META[c].zh)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-day">{t('Day', '日期')}</Label>
              <select id="item-day" className={selectClass} value={dayId} onChange={(e) => setDayId(e.target.value)}>
                <option value={UNSCHEDULED}>{t('Unscheduled', '未排程')}</option>
                {days.map((d, i) => (
                  <option key={d.id} value={d.id}>
                    {dayOptionLabel(d, i, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-place">{t('Place (optional)', '地點（選填）')}</Label>
            <Input
              id="item-place"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={t('Name or address — used for the maps link', '名稱或地址——用於地圖連結')}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-start">{t('Start (optional)', '開始（選填）')}</Label>
              <Input id="item-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-end">{t('End (optional)', '結束（選填）')}</Label>
              <Input id="item-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-cost">{t('Cost (optional)', '花費（選填）')}</Label>
              <Input
                id="item-cost"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="item-cur">{t('Cur.', '幣別')}</Label>
              <Input id="item-cur" value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="JPY" />
            </div>
          </div>

          {category === 'transport' ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-tmode">{t('Transport', '交通方式')}</Label>
                <Input
                  id="item-tmode"
                  value={transportMode}
                  onChange={(e) => setTransportMode(e.target.value)}
                  placeholder={t('train, walk…', '電車、步行…')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="item-tdetail">{t('Detail', '細節')}</Label>
                <Input
                  id="item-tdetail"
                  value={transportDetail}
                  onChange={(e) => setTransportDetail(e.target.value)}
                  placeholder={t('A → B, 6 min', 'A → B, 6 分鐘')}
                />
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-url">{t('Booking link (optional)', '訂房／訂票連結（選填）')}</Label>
            <Input
              id="item-url"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-notes">{t('Notes (optional)', '備註（選填）')}</Label>
            <Textarea id="item-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending || !title.trim()}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add activity', '新增活動')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
