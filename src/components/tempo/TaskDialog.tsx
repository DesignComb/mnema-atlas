import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAddReminder, useCreateTask, useSetRecurrence, useUpdateTask } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { TaskListRow, TaskRow } from '@/lib/database.types'
import { buildRRule, computeOccurrence, parseRRule, WEEKDAYS, type Freq } from '@/lib/recurrence'
import { TagInput } from '@/components/editor/TagInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const INBOX = 'inbox'

const PRIORITIES = [
  { v: 0, en: 'No priority', zh: '無優先' },
  { v: 1, en: 'Low', zh: '低' },
  { v: 2, en: 'Medium', zh: '中' },
  { v: 3, en: 'High', zh: '高' },
  { v: 4, en: 'Urgent', zh: '緊急' },
] as const

const WD_EN = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WD_ZH = ['一', '二', '三', '四', '五', '六', '日']

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function TaskDialog({
  open,
  onOpenChange,
  lists,
  defaultListId,
  task,
  labelSuggestions = [],
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  lists: TaskListRow[]
  defaultListId?: string | null
  task?: TaskRow
  labelSuggestions?: string[]
}) {
  const t = useT()
  const editing = Boolean(task)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const setRecurrence = useSetRecurrence()
  const addReminder = useAddReminder()

  const [title, setTitle] = useState('')
  const [listId, setListId] = useState<string>(INBOX)
  const [priority, setPriority] = useState(0)
  const [kind, setKind] = useState<'task' | 'habit'>('task')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  // recurrence
  const [repeat, setRepeat] = useState<Freq | 'none'>('none')
  const [interval, setIntervalV] = useState(1)
  const [byday, setByday] = useState<string[]>([])
  const [afterCompletion, setAfterCompletion] = useState(false)
  const [reminderLocal, setReminderLocal] = useState('')

  useEffect(() => {
    if (!open) return
    setReminderLocal('')
    setTitle(task?.title ?? '')
    setListId(task?.list_id ?? defaultListId ?? INBOX)
    setPriority(task?.priority ?? 0)
    setKind((task?.kind as 'task' | 'habit') ?? 'task')
    setDueDate(task?.due_date ?? '')
    setDueTime(task?.due_time ? task.due_time.slice(0, 5) : '')
    setLabels(task?.labels ?? [])
    setNotes(task?.description ?? '')
    const p = parseRRule(task?.recurrence_rule ?? null)
    setRepeat(p.freq)
    setIntervalV(p.interval)
    setByday(p.byday)
    setAfterCompletion(task?.recurrence_after_completion ?? false)
  }, [open, task, defaultListId])

  const pending = createTask.isPending || updateTask.isPending || setRecurrence.isPending || addReminder.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const list_id = listId === INBOX ? undefined : listId
    const rule = repeat === 'none' ? null : buildRRule(repeat, interval, byday)
    const anchor = dueDate || localToday()
    let next: string | undefined
    if (rule) next = (await computeOccurrence(rule, anchor, true)) ?? undefined
    try {
      let taskId = task?.id
      if (editing && task) {
        await updateTask.mutateAsync({
          task_id: task.id,
          title: title.trim(),
          description: notes || undefined,
          list_id,
          priority,
          labels,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
        })
        // Apply recurrence changes (or clear it) via the dedicated RPC.
        if (rule || task.recurrence_rule) {
          await setRecurrence.mutateAsync({
            task_id: task.id,
            recurrence_rule: rule ?? '',
            recurrence_after_completion: afterCompletion,
            recurrence_anchor: rule ? anchor : undefined,
            next_occurrence: rule ? next : undefined,
          })
        }
      } else {
        const created = await createTask.mutateAsync({
          title: title.trim(),
          list_id,
          description: notes || undefined,
          priority,
          labels,
          kind,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
          recurrence_rule: rule ?? undefined,
          recurrence_after_completion: rule ? afterCompletion : undefined,
          recurrence_anchor: rule ? anchor : undefined,
          next_occurrence: rule ? next : undefined,
        })
        taskId = created.id
      }
      // A datetime here adds a reminder (absolute instant from local time).
      if (reminderLocal && taskId) {
        await addReminder.mutateAsync({ task_id: taskId, remind_at: new Date(reminderLocal).toISOString() })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save task', '儲存任務失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit task', '編輯任務') : t('New task', '新增任務')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <input
            id="task-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('What needs doing?', '要做什麼?')}
            className="w-full border-b border-border bg-transparent pb-2 text-lg font-semibold outline-none placeholder:text-muted-foreground/50 focus:border-brand"
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-list">{t('List', '清單')}</Label>
              <Select id="task-list" value={listId} onChange={(e) => setListId(e.target.value)}>
                <option value={INBOX}>{t('Inbox', '收件匣')}</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-priority">{t('Priority', '優先級')}</Label>
              <Select id="task-priority" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
                {PRIORITIES.map((p) => (
                  <option key={p.v} value={p.v}>
                    {t(p.en, p.zh)}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due">{t('Due date', '截止日')}</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="task-due-time">{t('Due time', '截止時間')}</Label>
              <Input id="task-due-time" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
            </div>
          </div>

          {/* Recurrence */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-repeat">{t('Repeat', '重複')}</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                id="task-repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value as Freq | 'none')}
                className="w-40"
              >
                <option value="none">{t('Does not repeat', '不重複')}</option>
                <option value="DAILY">{t('Daily', '每天')}</option>
                <option value="WEEKLY">{t('Weekly', '每週')}</option>
                <option value="MONTHLY">{t('Monthly', '每月')}</option>
                <option value="YEARLY">{t('Yearly', '每年')}</option>
              </Select>
              {repeat !== 'none' ? (
                <div className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <span>{t('every', '每')}</span>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={interval}
                    onChange={(e) => setIntervalV(Math.max(1, Number(e.target.value) || 1))}
                    className="w-16"
                  />
                </div>
              ) : null}
            </div>
            {repeat === 'WEEKLY' ? (
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d, i) => {
                  const on = byday.includes(d)
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => setByday(on ? byday.filter((x) => x !== d) : [...byday, d])}
                      className={`size-7 rounded-full border text-[11px] font-medium transition ${
                        on ? 'border-brand bg-brand-muted text-brand' : 'border-border text-muted-foreground hover:border-brand/40'
                      }`}
                    >
                      {t(WD_EN[i], WD_ZH[i])}
                    </button>
                  )
                })}
              </div>
            ) : null}
            {repeat !== 'none' ? (
              <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <input type="checkbox" checked={afterCompletion} onChange={(e) => setAfterCompletion(e.target.checked)} />
                {t('Count next from when I complete it', '完成後才開始算下一次')}
              </label>
            ) : null}
          </div>

          {/* Reminder */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-remind">{t('Reminder', '提醒')}</Label>
            <Input
              id="task-remind"
              type="datetime-local"
              value={reminderLocal}
              onChange={(e) => setReminderLocal(e.target.value)}
            />
            {reminderLocal ? (
              <p className="text-[11px] text-muted-foreground">
                {t('Sends a push when due — enable reminders in Settings first.', '到時會推播 —— 請先在「設定」開啟提醒。')}
              </p>
            ) : null}
          </div>

          {!editing ? (
            <div className="flex flex-col gap-1.5">
              <Label>{t('Type', '類型')}</Label>
              <div className="flex gap-1.5">
                {(['task', 'habit'] as const).map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setKind(k)}
                    className={`rounded-md border px-3 py-1.5 text-[13px] transition ${
                      kind === k ? 'border-brand bg-brand-muted text-brand' : 'border-border text-muted-foreground hover:border-brand/40'
                    }`}
                  >
                    {k === 'task' ? t('Task', '任務') : t('Habit', '習慣')}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label>{t('Labels', '標籤')}</Label>
            <TagInput tags={labels} onChange={setLabels} suggestions={labelSuggestions} listId="tempo-labels" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="task-notes">{t('Notes', '備註')}</Label>
            <Textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending || !title.trim()}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add task', '新增任務')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
