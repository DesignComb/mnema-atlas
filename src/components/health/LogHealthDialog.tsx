import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useLogHealth, useUpdateHealthLog } from '@/lib/hooks'
import { useI18n } from '@/lib/i18n'
import type { HealthLogKind } from '@shared/schemas'
import type { HealthLogRow } from '@/lib/database.types'
import { HEALTH_KINDS, kindMeta, localTodayISO, type KindMeta } from '@/lib/health'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

function hm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Local date + HH:MM → ISO timestamp; undefined when either part is missing/invalid. */
function buildLoggedAt(dateISO: string, time: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(time)) return undefined
  const [y, m, d] = dateISO.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y, m - 1, d, h, min).toISOString()
}

export function LogHealthDialog({
  open,
  onOpenChange,
  kinds = HEALTH_KINDS,
  defaultKind,
  log,
  weightUnit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Restrict the kind picker to the user's enabled modules. */
  kinds?: KindMeta[]
  defaultKind?: HealthLogKind
  log?: HealthLogRow
  /** The user's weight-unit preference (health_settings) — honoured for weight logs (A10). */
  weightUnit?: string
}) {
  const { t } = useI18n()
  const editing = Boolean(log)
  const logHealth = useLogHealth()
  const updateLog = useUpdateHealthLog()

  const [kind, setKind] = useState<HealthLogKind>('weight')
  const [value, setValue] = useState('')
  const [value2, setValue2] = useState('')
  const [textValue, setTextValue] = useState('')
  const [unit, setUnit] = useState('')
  const [date, setDate] = useState(localTodayISO())
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    const k = (log?.kind as HealthLogKind) ?? defaultKind ?? (kinds[0]?.kind ?? 'weight')
    setKind(k)
    setValue(log?.value != null ? String(log.value) : '')
    setValue2(log?.value2 != null ? String(log.value2) : '')
    setTextValue(log?.text_value ?? '')
    setUnit(log?.unit ?? '')
    setDate(log?.logged_date ?? localTodayISO())
    // Time matters (fasting vs post-meal glucose) — keep it editable, default now (A10).
    setTime(hm(log?.logged_at ? new Date(log.logged_at) : new Date()))
    setNote(log?.note ?? '')
  }, [open, log, defaultKind, kinds])

  const meta = useMemo(() => kindMeta(kind), [kind])
  const fields = meta?.fields ?? ['value']
  const pending = logHealth.isPending || updateLog.isPending
  /** Unit actually applied when the field is left blank — weight honours the setting. */
  const defaultUnit = kind === 'weight' && weightUnit ? weightUnit : meta?.unit

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
    if (fields.includes('value') && value.trim() && Number.isNaN(Number(value))) {
      toast.error(t('Value must be a number', '數值必須是數字'))
      return
    }
    try {
      if (editing && log) {
        await updateLog.mutateAsync({
          log_id: log.id,
          value: num(value),
          value2: num(value2),
          text_value: textValue.trim() || undefined,
          unit: unit.trim() || undefined,
          logged_date: date || undefined,
          logged_at: buildLoggedAt(date, time),
          note: note.trim() || undefined,
        })
      } else {
        await logHealth.mutateAsync({
          kind,
          value: fields.includes('value') ? num(value) : undefined,
          value2: fields.includes('value2') ? num(value2) : undefined,
          text_value: fields.includes('text') ? textValue.trim() || undefined : undefined,
          unit: unit.trim() || defaultUnit || undefined,
          logged_date: date || undefined,
          logged_at: buildLoggedAt(date, time),
          note: note.trim() || undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save', '儲存失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit entry', '編輯紀錄') : t('Log health', '記錄健康')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hl-kind">{t('What', '項目')}</Label>
            <Select
              id="hl-kind"
              value={kind}
              disabled={editing}
              onChange={(e) => {
                const k = e.target.value as HealthLogKind
                setKind(k)
                setUnit('')
              }}
            >
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {t(k.en, k.zh)}
                </option>
              ))}
            </Select>
          </div>

          {fields.includes('text') ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hl-text">
                {kind === 'meal'
                  ? t('What did you eat?', '吃了什麼?')
                  : kind === 'workout'
                    ? t('Activity', '運動類型')
                    : kind === 'symptom'
                      ? t('Symptom', '症狀')
                      : t('Description', '描述')}
              </Label>
              <Input
                id="hl-text"
                autoFocus
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder={
                  kind === 'meal'
                    ? t('e.g. chicken rice + iced tea', '例如:雞肉飯加紅茶')
                    : kind === 'workout'
                      ? t('e.g. running', '例如:跑步')
                      : kind === 'symptom'
                        ? t('e.g. headache', '例如:頭痛')
                        : ''
                }
              />
            </div>
          ) : null}

          {fields.includes('value') || fields.includes('value2') ? (
            <div className="grid grid-cols-2 gap-3">
              {fields.includes('value') ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hl-value">
                    {kind === 'blood_pressure' ? t('Systolic', '收縮壓') : t('Value', '數值')}
                    {defaultUnit ? <span className="text-muted-foreground"> ({defaultUnit})</span> : null}
                  </Label>
                  <Input
                    id="hl-value"
                    inputMode="decimal"
                    autoFocus={!fields.includes('text')}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0"
                  />
                </div>
              ) : null}
              {fields.includes('value2') ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hl-value2">{t('Diastolic', '舒張壓')}</Label>
                  <Input id="hl-value2" inputMode="decimal" value={value2} onChange={(e) => setValue2(e.target.value)} placeholder="0" />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hl-date">{t('Date', '日期')}</Label>
              <Input id="hl-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hl-time">{t('Time', '時間')}</Label>
              <Input id="hl-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            {defaultUnit ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="hl-unit">{t('Unit', '單位')}</Label>
                <Input id="hl-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={defaultUnit} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hl-note">{t('Note', '備註')}</Label>
            <Textarea id="hl-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Log', '記錄')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
