import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useCreateItinerary, useUpdateItinerary } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { ItineraryRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function TripDialog({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** When provided, the dialog edits this trip instead of creating one. */
  trip?: ItineraryRow
}) {
  const editing = !!trip
  const [title, setTitle] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [timezone, setTimezone] = useState('')
  const [currency, setCurrency] = useState('')
  const [notes, setNotes] = useState('')
  const create = useCreateItinerary()
  const update = useUpdateItinerary()
  const navigate = useNavigate()
  const t = useT()

  useEffect(() => {
    if (open) {
      setTitle(trip?.title ?? '')
      setDestination(trip?.destination ?? '')
      setStartDate(trip?.start_date ?? '')
      setEndDate(trip?.end_date ?? '')
      setTimezone(trip?.timezone ?? '')
      setCurrency(trip?.default_currency ?? '')
      setNotes(trip?.notes ?? '')
    }
  }, [open, trip])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const fields = {
      title: title.trim(),
      destination: destination.trim() || undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      timezone: timezone.trim() || undefined,
      default_currency: currency.trim() || undefined,
      notes: notes.trim() || undefined,
    }
    try {
      if (editing && trip) {
        await update.mutateAsync({ itinerary_id: trip.id, ...fields })
        toast.success(t('Trip updated', '已更新行程'))
        onOpenChange(false)
      } else {
        const row = await create.mutateAsync(fields)
        toast.success(t(`Trip “${fields.title}” created`, `已建立行程「${fields.title}」`))
        onOpenChange(false)
        navigate({ to: '/trips/$tripId', params: { tripId: row.id } })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save trip', '儲存行程失敗'))
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit trip', '編輯行程') : t('New trip', '新增行程')}</DialogTitle>
          <DialogDescription>
            {t('A trip holds your day-by-day itinerary.', '行程用來安排你每天的旅遊規劃。')}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-title">{t('Title', '標題')}</Label>
            <Input
              id="trip-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('e.g. Kyoto with Tracy', '例如：京都之旅')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-dest">{t('Destination (optional)', '目的地（選填）')}</Label>
            <Input
              id="trip-dest"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. Kyoto, Japan"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trip-start">{t('Start', '開始')}</Label>
              <Input id="trip-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trip-end">{t('End', '結束')}</Label>
              <Input id="trip-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trip-tz">{t('Time zone (optional)', '時區（選填）')}</Label>
              <Input
                id="trip-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Tokyo"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="trip-cur">{t('Currency', '幣別')}</Label>
              <Input
                id="trip-cur"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="TWD"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-notes">{t('Notes (optional)', '備註（選填）')}</Label>
            <Textarea
              id="trip-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('Flights, hotels, anything to remember…', '航班、住宿，或任何要記住的事…')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending || !title.trim()}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Create trip', '建立行程')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
