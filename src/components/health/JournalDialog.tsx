import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSetJournalEntry } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { JournalEntryRow } from '@/lib/database.types'
import { localTodayISO, MOOD_FACES, MOOD_EN, MOOD_ZH } from '@/lib/health'
import { TagInput } from '@/components/editor/TagInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function Rating({
  label,
  value,
  onChange,
  faces,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  faces?: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n
          return (
            <button
              type="button"
              key={n}
              onClick={() => onChange(on ? null : n)}
              title={faces ? t(MOOD_EN[n - 1], MOOD_ZH[n - 1]) : String(n)}
              className={`flex h-10 flex-1 items-center justify-center rounded-md border text-lg transition ${
                on ? 'border-brand bg-brand-muted text-brand' : 'border-border text-muted-foreground hover:border-brand/40'
              }`}
            >
              {faces ? MOOD_FACES[n - 1] : n}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function JournalDialog({
  open,
  onOpenChange,
  entry,
  defaultDate,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  entry?: JournalEntryRow
  defaultDate?: string
}) {
  const { t } = useI18n()
  const save = useSetJournalEntry()

  const [date, setDate] = useState(localTodayISO())
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    setDate(entry?.entry_date ?? defaultDate ?? localTodayISO())
    setMood(entry?.mood ?? null)
    setEnergy(entry?.energy ?? null)
    setBody(entry?.body ?? '')
    setTags(entry?.tags ?? [])
  }, [open, entry, defaultDate])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mood == null && energy == null && !body.trim() && tags.length === 0) {
      toast.error(t('Add a mood or a few words first', '先選個心情或寫幾個字'))
      return
    }
    try {
      await save.mutateAsync({
        entry_date: date,
        mood: mood ?? undefined,
        energy: energy ?? undefined,
        body: body.trim() || undefined,
        tags,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>{t('How was today?', '今天如何?')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jr-date">{t('Date', '日期')}</Label>
            <Input id="jr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Rating label={t('Mood', '心情')} value={mood} onChange={setMood} faces />
          <Rating label={t('Energy', '精力')} value={energy} onChange={setEnergy} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jr-body">{t('Journal', '日記')}</Label>
            <Textarea
              id="jr-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={t('A few words about today…', '寫幾句今天的事…')}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('Tags', '標籤')}</Label>
            <TagInput tags={tags} onChange={setTags} listId="journal-tags" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? t('Saving…', '儲存中…') : t('Save', '儲存')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
