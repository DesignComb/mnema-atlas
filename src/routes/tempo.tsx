import { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Flag,
  Flame,
  Inbox,
  ListTodo,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useCheckIn,
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useDeleteTaskList,
  useTaskLists,
  useTasks,
  useUncompleteTask,
} from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { TaskListRow, TaskRow } from '@/lib/database.types'
import { computeOccurrence, shortRecurrenceLabel } from '@/lib/recurrence'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TaskDialog } from '@/components/tempo/TaskDialog'
import { ListDialog } from '@/components/tempo/ListDialog'

type ViewKey = 'all' | 'today' | 'upcoming' | 'habits' | 'calendar'

const VIEW_LABEL: Record<ViewKey, [string, string]> = {
  all: ['All tasks', '所有任務'],
  today: ['Today', '今天'],
  upcoming: ['Upcoming', '即將'],
  habits: ['Habits', '習慣'],
  calendar: ['Calendar', '行事曆'],
}

const PRIO_COLOR: Record<number, string> = {
  4: 'text-red-500',
  3: 'text-orange-500',
  2: 'text-amber-500',
  1: 'text-muted-foreground/60',
}

function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function cmpDate(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (!a) return 1
  if (!b) return -1
  return a < b ? -1 : 1
}

export function TempoScreen() {
  const t = useT()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { view?: ViewKey; list?: string; new?: 'list' }
  const view: ViewKey = search.view ?? 'all'
  const listSel = search.list ?? 'all'

  const { data: lists } = useTaskLists()
  const [showDone, setShowDone] = useState(false)
  const { data: tasks, isLoading } = useTasks({ status: showDone ? 'done' : 'todo', limit: 500 })
  const [draft, setDraft] = useState('')
  const [taskDialog, setTaskDialog] = useState<{ open: boolean; task?: TaskRow }>({ open: false })
  const [listDialog, setListDialog] = useState<{ open: boolean; list?: TaskListRow }>({ open: false })

  const createTask = useCreateTask()
  const complete = useCompleteTask()
  const uncomplete = useUncompleteTask()
  const del = useDeleteTask()
  const checkIn = useCheckIn()
  const delList = useDeleteTaskList()

  const activeLists = (lists ?? []).filter((l) => !l.is_archived)
  const labelSuggestions = Array.from(new Set((tasks ?? []).flatMap((x) => x.labels ?? [])))
  const today = localToday()
  const selectedList = activeLists.find((l) => l.id === listSel)

  // The sidebar's "+" for lists routes here with ?new=list — open the dialog, then clear it.
  useEffect(() => {
    if (search.new === 'list') {
      setListDialog({ open: true })
      navigate({ to: '/tempo', search: (p) => ({ ...p, new: undefined }), replace: true })
    }
  }, [search.new, navigate])

  const filtered = (tasks ?? []).filter((task) => {
    if (listSel === 'inbox' && task.list_id !== null) return false
    if (listSel !== 'all' && listSel !== 'inbox' && task.list_id !== listSel) return false
    if (view === 'habits') return task.kind === 'habit'
    if (view === 'today') return (task.due_date != null && task.due_date <= today) || task.scheduled_date === today
    if (view === 'upcoming') return task.due_date != null && task.due_date > today
    return true
  })
  const sorted = [...filtered].sort(
    (a, b) => b.priority - a.priority || cmpDate(a.due_date, b.due_date) || a.sort_order - b.sort_order,
  )

  // Heading reflects the focused list (if any), else the active view.
  const heading =
    listSel === 'inbox'
      ? t('Inbox', '收件匣')
      : selectedList
        ? selectedList.name
        : t(...VIEW_LABEL[view])
  const headingIcon =
    view === 'habits' ? <Flame className="size-4" /> : listSel === 'inbox' ? <Inbox className="size-4" /> : <ListTodo className="size-4" />
  // When a list is focused but the view is a time filter, show that as context.
  const viewContext = selectedList || listSel === 'inbox' ? (view !== 'all' ? t(...VIEW_LABEL[view]) : null) : null

  async function quickAdd() {
    const title = draft.trim()
    if (!title) return
    setDraft('')
    try {
      await createTask.mutateAsync({
        title,
        list_id: listSel !== 'all' && listSel !== 'inbox' ? listSel : undefined,
        kind: view === 'habits' ? 'habit' : 'task',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed to add task', '新增任務失敗'))
    }
  }

  async function toggle(task: TaskRow) {
    if (task.kind === 'habit') {
      checkIn.mutate({ taskId: task.id }, { onSuccess: () => toast.success(t('Checked in', '已打卡')) })
      return
    }
    if (task.status === 'done') {
      uncomplete.mutate(task.id)
      return
    }
    if (task.recurrence_rule) {
      // Compute the next occurrence (full RRULE) so BYDAY etc. advance correctly.
      const base = task.recurrence_after_completion
        ? today
        : task.next_occurrence ?? task.due_date ?? task.scheduled_date ?? today
      const next = await computeOccurrence(task.recurrence_rule, base, false)
      complete.mutate({ taskId: task.id, nextOccurrence: next ?? undefined })
    } else {
      complete.mutate({ taskId: task.id })
    }
  }

  async function removeList(list: TaskListRow) {
    if (
      !confirm(
        t(`Delete list “${list.name}”? Its tasks move to the Inbox.`, `刪除清單「${list.name}」?裡面的任務會移到收件匣。`),
      )
    )
      return
    await delList.mutateAsync(list.id)
    navigate({ to: '/tempo', search: (p) => ({ ...p, list: undefined }), replace: true })
  }

  return (
    <>
      <PageHeader
        title={heading}
        subtitle={
          tasks
            ? viewContext
              ? `${viewContext} · ${t(`${sorted.length} shown`, `${sorted.length} 項`)}`
              : t(`${sorted.length} shown`, `顯示 ${sorted.length} 項`)
            : undefined
        }
        icon={headingIcon}
        actions={
          <div className="flex items-center gap-1.5">
            {selectedList ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label={t('List options', '清單選項')}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setListDialog({ open: true, list: selectedList })}>
                    <Pencil /> {t('Rename list', '重新命名清單')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                    onSelect={() => void removeList(selectedList)}
                  >
                    <Trash2 /> {t('Delete list', '刪除清單')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button variant="brand" size="sm" onClick={() => setTaskDialog({ open: true })}>
              <Plus className="size-4" /> <span className="hidden sm:inline">{t('New task', '新增任務')}</span>
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          {view === 'calendar' ? (
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title={t('Calendar is coming', '行事曆即將推出')}
              description={t(
                'A month, week, and time-blocking view lands in the next update.',
                '月曆、週曆與時間區塊檢視會在下次更新加入。',
              )}
            />
          ) : (
            <>
              {/* Quick add */}
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-soft focus-within:border-brand/50">
                <Plus className="size-4 shrink-0 text-muted-foreground" />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void quickAdd()
                    }
                  }}
                  placeholder={view === 'habits' ? t('Add a habit…', '新增一個習慣…') : t('Add a task…', '新增一項任務…')}
                  className="flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              {isLoading ? (
                <div className="space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-card" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <EmptyState
                  icon={<ListTodo className="size-6" />}
                  title={showDone ? t('Nothing completed yet', '還沒有完成的項目') : t('All clear', '都清空了')}
                  description={t(
                    'Add a task above, or let a connected AI add and organise them for you.',
                    '在上方新增任務,或讓連接的 AI 幫你新增與整理。',
                  )}
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
                  {sorted.map((task) => (
                    <TaskRowItem
                      key={task.id}
                      task={task}
                      onToggle={() => toggle(task)}
                      onEdit={() => setTaskDialog({ open: true, task })}
                      onDelete={() => del.mutate(task.id)}
                      t={t}
                      today={today}
                    />
                  ))}
                </div>
              )}

              <button
                onClick={() => setShowDone((v) => !v)}
                className="mt-3 text-[13px] font-medium text-muted-foreground transition hover:text-brand"
              >
                {showDone ? t('← Back to open tasks', '← 回到未完成') : t('Show completed', '顯示已完成')}
              </button>
            </>
          )}
        </div>
      </div>

      <TaskDialog
        open={taskDialog.open}
        onOpenChange={(o) => setTaskDialog((s) => ({ ...s, open: o }))}
        lists={activeLists}
        defaultListId={listSel !== 'all' && listSel !== 'inbox' ? listSel : null}
        task={taskDialog.task}
        labelSuggestions={labelSuggestions}
      />
      <ListDialog
        open={listDialog.open}
        onOpenChange={(o) => setListDialog((s) => ({ ...s, open: o }))}
        list={listDialog.list}
      />
    </>
  )
}

function TaskRowItem({
  task,
  onToggle,
  onEdit,
  onDelete,
  t,
  today,
}: {
  task: TaskRow
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  t: (en: string, zh: string) => string
  today: string
}) {
  const done = task.status === 'done'
  const isHabit = task.kind === 'habit'
  const overdue = !done && task.due_date != null && task.due_date < today

  return (
    <div className="group flex items-start gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
      <button
        onClick={onToggle}
        className="mt-0.5 shrink-0 text-muted-foreground transition hover:text-brand"
        aria-label={isHabit ? t('Check in', '打卡') : done ? t('Reopen', '重新開啟') : t('Complete', '完成')}
      >
        {isHabit ? (
          <Flame className="size-5 text-orange-500/80" />
        ) : done ? (
          <CheckCircle2 className="size-5 text-brand" />
        ) : (
          <Circle className="size-5" />
        )}
      </button>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          {task.priority > 0 ? <Flag className={`size-3.5 shrink-0 ${PRIO_COLOR[task.priority]}`} /> : null}
          <span className={`truncate text-[14.5px] ${done ? 'text-muted-foreground line-through' : 'font-medium text-foreground'}`}>
            {task.title}
          </span>
        </div>
        {task.due_date || task.recurrence_rule || (isHabit && task.current_streak > 0) || (task.labels ?? []).length ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-muted-foreground">
            {task.due_date ? (
              <span className={`inline-flex items-center gap-1 ${overdue ? 'text-red-500' : ''}`}>
                <CalendarDays className="size-3" /> {task.due_date}
                {task.due_time ? ` ${task.due_time.slice(0, 5)}` : ''}
              </span>
            ) : null}
            {task.recurrence_rule ? (
              <span className="inline-flex items-center gap-1">
                <Repeat className="size-3" /> {shortRecurrenceLabel(task.recurrence_rule, t)}
              </span>
            ) : null}
            {isHabit && task.current_streak > 0 ? (
              <span className="inline-flex items-center gap-1 text-orange-500">
                <Flame className="size-3" /> {task.current_streak}
              </span>
            ) : null}
            {(task.labels ?? []).slice(0, 4).map((l) => (
              <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                #{l}
              </span>
            ))}
          </div>
        ) : null}
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 [@media(hover:none)]:opacity-100"
            aria-label={t('Task options', '任務選項')}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> {t('Edit', '編輯')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive [&_svg]:text-destructive"
            onSelect={onDelete}
          >
            <Trash2 /> {t('Delete', '刪除')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
