import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'motion/react'
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  FilePlus2,
  FileText,
  Flame,
  GraduationCap,
  Layers,
  ListTodo,
  NotebookPen,
  Settings2,
  Sparkles,
  Utensils,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useBudgetStatus,
  useCheckInsInRange,
  useCompleteTask,
  useDecks,
  useDueCards,
  useJournalEntries,
  useLedgers,
  useMealPlans,
  useNewNote,
  useNotes,
  useRecipes,
  useSeedSample,
  useSetUserLayout,
  useTasks,
  useUncompleteTask,
  useUserLayout,
} from '@/lib/hooks'
import { readLayoutMirror } from '@/lib/api'
import { useHiddenKeys } from '@/lib/undoable'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { AiImportButton } from '@/components/app-shell/AiImportButton'
import { Button } from '@/components/ui/button'
import { HabitCheckButton } from '@/components/tempo/HabitCheckButton'
import { useI18n } from '@/lib/i18n'
import { fmtLocalDate, modKey, relativeDue } from '@/lib/utils'
import { localTodayISO, MOOD_FACES } from '@/lib/health'
import { greeting, mergeLayout, todayTasks, type LayoutSection } from '@/lib/today'
import { fmtMoney, monthRange } from '@/lib/money'
import { computeOccurrence, habitTodayISO, minutesUntilReset } from '@/lib/recurrence'
import type { JournalEntryRow, TaskRow } from '@/lib/database.types'
import { JournalDialog } from '@/components/health/JournalDialog'
import { TodayCustomizeDialog } from '@/components/home/TodayCustomizeDialog'
import { PullToRefresh } from '@/lib/use-pull-to-refresh'

/**
 * Today's building blocks, in default order. The user can reorder/hide them
 * (⚙ in the header) — persisted per-user in user_layout['today'] (migration
 * 0041). `group: 'across'` keeps the cross-space cards in a tight cluster
 * (space-y-3) wherever they end up. Hidden-when-empty still applies on top:
 * a visible section with nothing to show renders nothing.
 */
type TodaySectionDef = { key: string; en: string; zh: string; group?: 'across' }
const TODAY_SECTIONS: readonly TodaySectionDef[] = [
  { key: 'journal', en: 'Journal', zh: '日記' },
  { key: 'tasks', en: 'Due today', zh: '今天到期', group: 'across' },
  { key: 'habits', en: 'Habits', zh: '習慣', group: 'across' },
  { key: 'meals', en: 'Meals', zh: '今日菜單', group: 'across' },
  { key: 'budget', en: 'Budget', zh: '預算', group: 'across' },
  { key: 'study', en: 'Study & stats', zh: '學習與統計' },
  { key: 'notes', en: 'Recent notes', zh: '最近的筆記' },
]
const TODAY_KEYS = TODAY_SECTIONS.map((s) => s.key)
const DEF_BY_KEY = new Map(TODAY_SECTIONS.map((s) => [s.key, s]))

/** Render visible sections in order; consecutive `group` siblings share a tight wrapper. */
function renderOrdered(sections: LayoutSection[], renderers: Record<string, ReactNode>): ReactNode[] {
  const visible = sections.filter((s) => !s.hidden && s.key in renderers)
  const blocks: ReactNode[] = []
  let i = 0
  while (i < visible.length) {
    const def = DEF_BY_KEY.get(visible[i].key)
    if (def?.group) {
      const run: string[] = []
      while (i < visible.length && DEF_BY_KEY.get(visible[i].key)?.group === def.group) {
        run.push(visible[i].key)
        i++
      }
      blocks.push(
        // empty:hidden — when every card in the cluster renders null, the
        // wrapper must not linger as a phantom gap in the page rhythm.
        <div key={run[0]} className="space-y-3 empty:hidden">
          {run.map((k) => (
            <Fragment key={k}>{renderers[k]}</Fragment>
          ))}
        </div>,
      )
    } else {
      blocks.push(<Fragment key={visible[i].key}>{renderers[visible[i].key]}</Fragment>)
      i++
    }
  }
  return blocks
}

export function HomeScreen() {
  const { t, lang } = useI18n()
  const qc = useQueryClient()
  const search = useSearch({ strict: false }) as { review?: string }
  const today = fmtLocalDate(new Date(), lang, { weekday: 'long', month: 'long', day: 'numeric' })

  // Journal state lives at screen level (not inside the section) so the
  // ?review=1 deep link can open the dialog even if the section is hidden.
  const todayISO = localTodayISO()
  const { data: recentJournal = [] } = useJournalEntries()
  const todayEntry = recentJournal.find((j) => j.entry_date === todayISO)
  const yIso = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const missedYesterday = !recentJournal.some((j) => j.entry_date === yIso)
  const [journalDialog, setJournalDialog] = useState<{ open: boolean; date?: string }>({ open: false })

  // Open the journal automatically when arrived from the review push.
  useEffect(() => {
    if (search.review && !todayEntry) setJournalDialog({ open: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.review])

  // Layout: server truth, mirrored to localStorage so a return visit paints in
  // the user's order on the first frame (no default-order flash mid-load).
  const { data: layoutMap } = useUserLayout()
  const [mirror] = useState(readLayoutMirror)
  const stored = (layoutMap ?? mirror)['today']
  const sections = useMemo(() => mergeLayout(stored, TODAY_KEYS), [stored])
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const setLayout = useSetUserLayout()

  const renderers: Record<string, ReactNode> = {
    journal: (
      <JournalNudge
        todayEntry={todayEntry}
        missedYesterday={missedYesterday}
        onOpen={(date) => setJournalDialog({ open: true, date })}
        yIso={yIso}
      />
    ),
    tasks: <TasksDueSection />,
    habits: <HabitsSection />,
    meals: <MealsSection />,
    budget: <BudgetSection />,
    study: <StudySection />,
    notes: <RecentNotesSection />,
  }

  return (
    <>
      <PageHeader
        title={t('Today', '今天')}
        subtitle={`${greeting(lang)} · ${today}`}
        actions={
          <div className="flex items-center gap-1.5">
            <AiImportButton />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('Customise Today', '自訂「今天」')}
              onClick={() => setCustomizeOpen(true)}
            >
              <Settings2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        }
      />
      {/* Today aggregates every space, so a pull refreshes everything: only the
          queries this screen mounts are active and actually refetch. */}
      <PullToRefresh onRefresh={() => qc.invalidateQueries()}>
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">{renderOrdered(sections, renderers)}</div>
      </PullToRefresh>

      <JournalDialog
        open={journalDialog.open}
        onOpenChange={(v) => setJournalDialog((s) => ({ ...s, open: v }))}
        entry={(journalDialog.date ?? todayISO) === todayISO ? todayEntry : recentJournal.find((j) => j.entry_date === journalDialog.date)}
        defaultDate={journalDialog.date ?? todayISO}
      />
      <TodayCustomizeDialog
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        sections={sections.map((s) => {
          const def = DEF_BY_KEY.get(s.key)
          return { ...s, en: def?.en ?? s.key, zh: def?.zh ?? s.key }
        })}
        onChange={(next) => setLayout.mutate({ surface: 'today', sections: next })}
      />
    </>
  )
}

/** End-of-day review card: nudge to journal (with yesterday's catch-up), or today's entry. */
function JournalNudge({
  todayEntry,
  missedYesterday,
  yIso,
  onOpen,
}: {
  todayEntry: JournalEntryRow | undefined
  missedYesterday: boolean
  yIso: string
  onOpen: (date?: string) => void
}) {
  const { t } = useI18n()
  if (!todayEntry) {
    return (
      <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <span className="text-2xl">📝</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t('How was today?', '今天如何?')}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {t('Log your mood and a few words about today.', '記下今天的心情與幾句話。')}
            {missedYesterday ? (
              <>
                {' · '}
                <button onClick={() => onOpen(yIso)} className="font-medium text-brand hover:underline">
                  {t('back-fill yesterday', '補記昨天')}
                </button>
              </>
            ) : null}
          </p>
        </div>
        <Button variant="brand" size="sm" onClick={() => onOpen()}>
          <NotebookPen className="size-4" /> {t('Reflect', '回顧')}
        </Button>
      </section>
    )
  }
  return (
    <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
      <span className="text-2xl">{todayEntry.mood ? MOOD_FACES[todayEntry.mood - 1] : '🌿'}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{t('Today logged', '今天已記錄')}</p>
        <p className="truncate text-[13px] text-muted-foreground">{todayEntry.body || t('Tap to add more', '點一下補充')}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onOpen()}>
        {t('Edit', '編輯')}
      </Button>
    </section>
  )
}

/**
 * Cross-space day, part 1 (audit QW9): tasks due, with inline complete so the
 * screen is actionable, not just a report. Hidden when empty. Shares cache
 * keys with Tempo — no duplicate fetches once visited.
 */
function TasksDueSection() {
  const { t } = useI18n()
  const todayIso = localTodayISO()
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  const hiddenKeys = useHiddenKeys()
  const complete = useCompleteTask()
  const uncomplete = useUncompleteTask()

  // Respect pending undoable deletes — a row mid-grace must not resurface here.
  const visible = (tasks ?? []).filter((x) => !hiddenKeys.has(`task:${x.id}`))
  const dueToday = todayTasks(visible, todayIso).slice(0, 5)

  async function completeTask(task: TaskRow) {
    if (task.recurrence_rule) {
      // Same roll as Tempo's toggle; no Undo (uncomplete can't rewind the roll).
      const base = task.recurrence_after_completion
        ? todayIso
        : task.next_occurrence ?? task.due_date ?? task.scheduled_date ?? todayIso
      const next = await computeOccurrence(task.recurrence_rule, base, false)
      complete.mutate({ taskId: task.id, nextOccurrence: next ?? undefined })
    } else {
      // Keep the promise so Undo sequences AFTER the complete lands — otherwise
      // a fast Undo could reach the server before the complete it reverts.
      const completed = complete.mutateAsync({ taskId: task.id }).catch(() => {})
      toast(t('Completed', '已完成'), {
        action: { label: t('Undo', '復原'), onClick: () => void completed.then(() => uncomplete.mutate(task.id)) },
        duration: 5000,
      })
    }
  }

  if (!dueToday.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <ListTodo className="size-3.5" /> {t('Due today', '今天到期')}
        </span>
        <Link to="/tempo" search={{ view: 'today' }} className="text-xs font-medium text-brand hover:underline">
          {t('Open Tempo', '打開 Tempo')}
        </Link>
      </div>
      {dueToday.map((task) => {
        const overdue = task.due_date != null && task.due_date < todayIso
        return (
          <div key={task.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0">
            <button
              onClick={() => void completeTask(task)}
              className="shrink-0 text-muted-foreground transition hover:text-brand"
              aria-label={t('Complete', '完成')}
            >
              {task.status === 'done' ? <CheckCircle2 className="size-5 text-brand" /> : <Circle className="size-5" />}
            </button>
            <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{task.title}</span>
            {overdue ? (
              <span className="shrink-0 text-[11.5px] font-medium text-red-500 dark:text-red-400">
                {t('Overdue', '逾期')}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

/** Cross-space day, part 2: habits left (at-risk surfaced), inline check-in. Hidden when empty. */
function HabitsSection() {
  const { t } = useI18n()
  const todayIso = localTodayISO()
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  const { data: checkins } = useCheckInsInRange(addDaysIso(todayIso, -1), addDaysIso(todayIso, 1))
  const hiddenKeys = useHiddenKeys()

  const visible = (tasks ?? []).filter((x) => !hiddenKeys.has(`task:${x.id}`))
  const done = new Set((checkins ?? []).map((c) => `${c.task_id}|${c.checkin_date}`))
  const habitsLeft = visible
    .filter((h) => h.kind === 'habit' && !done.has(`${h.id}|${habitTodayISO(h.reset_time, h.tz)}`))
    .slice(0, 4)

  if (!habitsLeft.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Flame className="size-3.5" /> {t('Habits left today', '今天還沒打卡')}
        </span>
        <Link to="/tempo" search={{ view: 'habits' }} className="text-xs font-medium text-brand hover:underline">
          {t('All habits', '所有習慣')}
        </Link>
      </div>
      {habitsLeft.map((h) => {
        const minsLeft = minutesUntilReset(h.reset_time, h.tz)
        const atRisk = minsLeft != null && minsLeft <= 180
        return (
          <div
            key={h.id}
            className={`flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0 ${
              atRisk ? 'bg-warning-muted/50' : ''
            }`}
          >
            <HabitCheckButton habitId={h.id} today={habitTodayISO(h.reset_time, h.tz)} iconClassName="size-5" title={h.title} />
            <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{h.title}</span>
            {h.current_streak > 0 ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[12px] text-orange-500">
                <Flame className="size-3" /> {h.current_streak}
              </span>
            ) : null}
            {atRisk && minsLeft != null ? (
              <span className="shrink-0 text-[11.5px] font-semibold text-warning">
                {minsLeft < 60 ? t(`${minsLeft}m left`, `剩 ${minsLeft} 分`) : t(`${Math.floor(minsLeft / 60)}h left`, `剩 ${Math.floor(minsLeft / 60)} 小時`)}
              </span>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

const SLOT_LABEL: Record<string, [string, string]> = {
  breakfast: ['Breakfast', '早餐'],
  lunch: ['Lunch', '午餐'],
  dinner: ['Dinner', '晚餐'],
  snack: ['Snack', '點心'],
}

/** Cross-space day, part 3: today's planned meals. Hidden when empty. */
function MealsSection() {
  const { t } = useI18n()
  const todayIso = localTodayISO()
  const { data: meals = [] } = useMealPlans(todayIso, todayIso)
  const { data: recipes = [] } = useRecipes()

  if (!meals.length) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Utensils className="size-3.5" /> {t('Today’s meals', '今日菜單')}
        </span>
        <Link to="/kitchen" search={{ ksection: 'plan' }} className="text-xs font-medium text-brand hover:underline">
          {t('Open Kitchen', '打開廚房')}
        </Link>
      </div>
      {meals.map((p) => (
        <div key={p.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-b-0 text-[14px]">
          <span className="w-12 shrink-0 text-[12.5px] text-muted-foreground">
            {t(...(SLOT_LABEL[p.slot] ?? [p.slot, p.slot]))}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground">
            {recipes.find((r) => r.id === p.recipe_id)?.title ?? p.title ?? '—'}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Cross-space day, part 4 (the QW9 gap): this month's budget pace —
 * "NT$X left · N days" across the first active ledger's budgets. Hidden when
 * the user has no ledger or no budgets set.
 */
function BudgetSection() {
  const { t } = useI18n()
  const { data: ledgers } = useLedgers()
  const ledger = (ledgers ?? []).find((l) => !l.is_archived)
  const range = monthRange()
  const { data: budgets } = useBudgetStatus(ledger?.id ?? '', range.from, range.to)

  if (!ledger || !budgets?.length) return null

  // An overall budget's `spent` already covers every category budget — summing
  // both double-counts. Prefer the overall row when one exists.
  const overall = budgets.find((b) => b.category_id == null)
  const rows = overall ? [overall] : budgets
  const total = rows.reduce((s, b) => s + Number(b.amount), 0)
  const spent = rows.reduce((s, b) => s + Number(b.spent), 0)
  const left = total - spent
  const now = new Date()
  // Days remaining in the month, today included — the denominator of the pace.
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1
  const over = left < 0
  const cur = ledger.base_currency

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">
          <Wallet className="size-3.5" /> {t('Budget this month', '本月預算')}
        </span>
        <Link to="/galleon" search={{ section: 'budgets' }} className="text-xs font-medium text-brand hover:underline">
          {t('Open Money', '打開記帳')}
        </Link>
      </div>
      <div className="flex items-center gap-3 px-4 py-2.5 text-[14px]">
        <span className={`min-w-0 flex-1 truncate ${over ? 'font-medium text-warning' : 'text-foreground'}`}>
          {over
            ? t(`${fmtMoney(-left, cur)} over budget`, `超支 ${fmtMoney(-left, cur)}`)
            : t(`${fmtMoney(left, cur)} left`, `剩 ${fmtMoney(left, cur)}`)}
        </span>
        <span className="shrink-0 text-[12.5px] text-muted-foreground">
          {t(`${daysLeft} day${daysLeft === 1 ? '' : 's'}`, `還有 ${daysLeft} 天`)}
          {!over && daysLeft > 0 ? ` · ≈${fmtMoney(left / daysLeft, cur)}/${t('day', '天')}` : ''}
        </span>
      </div>
    </div>
  )
}

/** Welcome (brand-new account) or the spaced-repetition hero, plus the stat tiles. */
function StudySection() {
  const { t } = useI18n()
  const { data: due } = useDueCards()
  const { data: notes } = useNotes()
  const { data: decks } = useDecks()
  const seed = useSeedSample()
  const newNote = useNewNote()

  const dueCount = due?.length ?? 0
  const isNew = (decks?.length ?? 0) === 0 && (notes?.length ?? 0) === 0

  return (
    <>
      {isNew ? (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-muted/70 to-card p-6 shadow-soft"
        >
          <div className="absolute inset-0 bg-dots opacity-40" />
          <div className="relative space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-brand">{t('Welcome', '歡迎')}</p>
            <h2 className="font-serif text-xl text-foreground sm:text-2xl">{t("Let's get your first cards going", '來建立你的第一批閃卡吧')}</h2>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t(
                'Add a tiny sample deck to see the whole loop in 30 seconds, or write your first note. An AI can also fill your library for you —',
                '加入一個小小的範例牌組，30 秒內看完整個流程，或寫下你的第一則筆記。也可以讓 AI 幫你充實資料庫 —',
              )}{' '}
              <Link to="/guide" className="font-medium text-brand hover:underline">{t('see how it works', '看看它如何運作')}</Link>.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="brand" onClick={() => seed.mutate()} disabled={seed.isPending}>
                <Sparkles className="size-4" /> {seed.isPending ? t('Adding…', '加入中…') : t('Add a sample deck', '加入範例牌組')}
              </Button>
              <Button variant="outline" onClick={() => void newNote.run()} disabled={newNote.isPending}>
                <FilePlus2 className="size-4" /> {t('Write a note', '寫一則筆記')}
              </Button>
            </div>
          </div>
        </motion.section>
      ) : (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-brand-muted/70 to-card p-6 shadow-soft"
        >
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wider text-brand">{t('Spaced repetition', '間隔重複')}</p>
              <h2 className="font-serif text-xl text-foreground sm:text-2xl">
                {dueCount > 0
                  ? t(`${dueCount} card${dueCount === 1 ? '' : 's'} due`, `${dueCount} 張閃卡待複習`)
                  : t('All caught up 🌿', '全部完成 🌿')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {dueCount > 0
                  ? t('Review them now to keep your memory fresh.', '現在就複習，讓記憶保持新鮮。')
                  : t('Nothing to review right now — add notes or come back later.', '目前沒有要複習的內容 — 新增筆記，或稍後再回來。')}
              </p>
            </div>
            <GraduationCap className="size-10 shrink-0 text-brand/30 sm:size-12" />
          </div>
          {dueCount > 0 ? (
            <Button asChild variant="brand" className="mt-4">
              <Link to="/study">
                {t('Start review', '開始複習')} <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : null}
        </motion.section>
      )}

      {/* Stat tiles */}
      <section className="grid grid-cols-3 gap-3">
        <StatTile icon={<Layers className="size-4" />} label={t('Decks', '牌組')} value={decks?.length ?? 0} />
        <StatTile icon={<FileText className="size-4" />} label={t('Notes', '筆記')} value={notes?.length ?? 0} />
        <StatTile icon={<GraduationCap className="size-4" />} label={t('Due now', '待複習')} value={dueCount} />
      </section>
    </>
  )
}

function RecentNotesSection() {
  const { t, lang } = useI18n()
  const { data: notes } = useNotes()

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t('Recent notes', '最近的筆記')}</h3>
        <Link to="/notes" className="text-xs font-medium text-brand hover:underline">
          {t('View all', '查看全部')}
        </Link>
      </div>
      {notes?.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {notes.slice(0, 6).map((n) => (
            <Link
              key={n.id}
              to="/notes/$noteId"
              params={{ noteId: n.id }}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-accent/50"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">{n.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeDue(n.updated_at, undefined, lang)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-5 text-sm text-muted-foreground">
          <Sparkles className="size-4 text-brand" />
          {t('No notes yet — press', '還沒有筆記 — 按')}{' '}
          <kbd className="rounded border border-border bg-card px-1.5 text-xs">{modKey}+K</kbd>{' '}
          {t('to create one, or connect an AI to fill them in.', '即可建立一則，或連接 AI 來幫你充實內容。')}
        </div>
      )}
    </section>
  )
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3 shadow-soft sm:px-4 sm:py-3.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground sm:text-2xl">{value}</p>
    </div>
  )
}
