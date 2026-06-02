import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateTask, useUpdateTask } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { TaskListRow, TaskRow } from '@/lib/database.types'
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

  const [title, setTitle] = useState('')
  const [listId, setListId] = useState<string>(INBOX)
  const [priority, setPriority] = useState(0)
  const [kind, setKind] = useState<'task' | 'habit'>('task')
  const [dueDate, setDueDate] = useState('')
  const [dueTime, setDueTime] = useState('')
  const [labels, setLabels] = useState<string[]>([])
  const [notes, setNotes] = useState('')

  // Seed from the task being edited (or defaults) whenever the dialog opens.
  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setListId(task?.list_id ?? defaultListId ?? INBOX)
    setPriority(task?.priority ?? 0)
    setKind((task?.kind as 'task' | 'habit') ?? 'task')
    setDueDate(task?.due_date ?? '')
    setDueTime(task?.due_time ? task.due_time.slice(0, 5) : '')
    setLabels(task?.labels ?? [])
    setNotes(task?.description ?? '')
  }, [open, task, defaultListId])

  const pending = createTask.isPending || updateTask.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const list_id = listId === INBOX ? undefined : listId
    try {
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
      } else {
        await createTask.mutateAsync({
          title: title.trim(),
          list_id,
          description: notes || undefined,
          priority,
          labels,
          kind,
          due_date: dueDate || undefined,
          due_time: dueTime || undefined,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save task', '儲存任務失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
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
