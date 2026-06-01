import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateDay, useUpdateDay } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { ItineraryDay } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DayDialog({
  open,
  onOpenChange,
  itineraryId,
  day,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  itineraryId: string
  /** When provided, edits this day instead of adding one. */
  day?: ItineraryDay
}) {
  const editing = !!day
  const [date, setDate] = useState('')
  const [label, setLabel] = useState('')
  const create = useCreateDay()
  const update = useUpdateDay()
  const t = useT()

  useEffect(() => {
    if (open) {
      setDate(day?.day_date ?? '')
      setLabel(day?.label ?? '')
    }
  }, [open, day])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (editing && day) {
        await update.mutateAsync({ day_id: day.id, day_date: date || undefined, label: label.trim() || undefined })
      } else {
        await create.mutateAsync({
          itinerary_id: itineraryId,
          day_date: date || undefined,
          label: label.trim() || undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save day', '儲存日期失敗'))
    }
  }

  const pending = create.isPending || update.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit day', '編輯日期') : t('Add day', '新增日期')}</DialogTitle>
          <DialogDescription>{t('Give the day a date and/or a label.', '為這一天設定日期與／或標籤。')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="day-date">{t('Date (optional)', '日期（選填）')}</Label>
            <Input id="day-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="day-label">{t('Label (optional)', '標籤（選填）')}</Label>
            <Input
              id="day-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('e.g. East Kyoto', '例如：京都東區')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add day', '新增日期')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
