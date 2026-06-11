import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateMedication, useUpdateMedication } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { MedicationRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Parse "08:00, 20:00" → ['08:00','20:00']; tolerant of spaces/、commas. */
function parseTimes(s: string): string[] {
  return s
    .split(/[,，、\s]+/)
    .map((x) => x.trim())
    .filter((x) => /^\d{1,2}:\d{2}$/.test(x))
    .map((x) => (x.length === 4 ? `0${x}` : x))
}

export function MedicationDialog({
  open,
  onOpenChange,
  medication,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  medication?: MedicationRow
}) {
  const { t } = useI18n()
  const editing = Boolean(medication)
  const create = useCreateMedication()
  const update = useUpdateMedication()

  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [times, setTimes] = useState('')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(medication?.name ?? '')
    setDosage(medication?.dosage ?? '')
    setTimes((medication?.times ?? []).join(', '))
    setNotes(medication?.notes ?? '')
    setActive(medication?.is_active ?? true)
  }, [open, medication])

  const pending = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('Name is required', '請輸入名稱'))
      return
    }
    const parsedTimes = parseTimes(times)
    try {
      if (editing && medication) {
        await update.mutateAsync({
          medication_id: medication.id,
          name: name.trim(),
          dosage: dosage.trim() || undefined,
          times: parsedTimes,
          notes: notes.trim() || undefined,
          is_active: active,
        })
      } else {
        await create.mutateAsync({
          name: name.trim(),
          dosage: dosage.trim() || undefined,
          times: parsedTimes,
          notes: notes.trim() || undefined,
          is_active: active,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit medication', '編輯用藥') : t('Add medication', '新增用藥')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-name">{t('Name', '名稱')}</Label>
            <Input id="med-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Vitamin D', '例如:維他命 D')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="med-dosage">{t('Dosage', '劑量')}</Label>
              <Input id="med-dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder={t('e.g. 1 tablet', '例如:1 顆')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="med-times">{t('Times', '時間')}</Label>
              <Input id="med-times" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="08:00, 20:00" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="med-notes">{t('Notes', '備註')}</Label>
            <Textarea id="med-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            {t('Currently taking', '目前服用中')}
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add', '新增')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
