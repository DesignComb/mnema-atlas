import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
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
  Sparkles,
  Utensils,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useCheckInsInRange,
  useCompleteTask,
  useDecks,
  useDueCards,
  useJournalEntries,
  useMealPlans,
  useNewNote,
  useNotes,
  useSeedSample,
  useTasks,
  useUncompleteTask,
} from '@/lib/hooks'
import { PageHeader } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import { HabitCheckButton } from '@/components/tempo/HabitCheckButton'
import { useI18n } from '@/lib/i18n'
import { fmtLocalDate, modKey, relativeDue } from '@/lib/utils'
import { localTodayISO, MOOD_FACES } from '@/lib/health'
import { greeting, todayTasks } from '@/lib/today'
import { computeOccurrence, habitTodayISO, minutesUntilReset } from '@/lib/recurrence'
import type { TaskRow } from '@/lib/database.types'
import { JournalDialog } from '@/components/health/JournalDialog'

export function HomeScreen() {
  const { t, lang } = useI18n()
  const { data: due } = useDueCards()
  const { data: notes } = useNotes()
  const { data: decks } = useDecks()
  const seed = useSeedSample()
  const newNote = useNewNote()
  const search = useSearch({ strict: false }) as { review?: string }

  const dueCount = due?.length ?? 0
  const isNew = (decks?.length ?? 0) === 0 && (notes?.length ?? 0) === 0
  const today = fmtLocalDate(new Date(), lang, { weekday: 'long', month: 'long', day: 'numeric' })

  // End-of-day review card: nudge to journal when today has no entry (and offer
  // to back-fill yesterday — the catch-up). The push deep-links with ?review=1.
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

  return (
    <>
      <PageHeader title={t('Today', '今天')} subtitle={`${greeting(lang)} · ${today}`} />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
          {!todayEntry ? (
            <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="text-2xl">📝</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t('How was today?', '今天如何?')}</p>
                <p className="truncate text-[13px] text-muted-foreground">
                  {t('Log your mood and a few words about today.', '記下今天的心情與幾句話。')}
                  {missedYesterday ? (
                    <>
                      {' · '}
                      <button onClick={() => setJournalDialog({ open: true, date: yIso })} className="font-medium text-brand hover:underline">
                        {t('back-fill yesterday', '補記昨天')}
                      </button>
                    </>
                  ) : null}
                </p>
              </div>
              <Button variant="brand" size="sm" onClick={() => setJournalDialog({ open: true })}>
                <NotebookPen className="size-4" /> {t('Reflect', '回顧')}
              </Button>
            </section>
          ) : (
            <section className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <span className="text-2xl">{todayEntry.mood ? MOOD_FACES[todayEntry.mood - 1] : '🌿'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t('Today logged', '今天已記錄')}</p>
                <p className="truncate text-[13px] text-muted-foreground">{todayEntry.body || t('Tap to add more', '點一下補充')}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setJournalDialog({ open: true })}>
                {t('Edit', '編輯')}
              </Button>
            </section>
          )}

          <TodayAcrossSpaces />

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
                <h2 className="font-serif text-xl text-foreground sm:text-2xl">{t("Let's get your first cards going", '來建立你的第一批卡片吧')}</h2>
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
                      ? t(`${dueCount} card${dueCount === 1 ? '' : 's'} due`, `${dueCount} 張卡片待複習`)
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

          {/* Recent notes */}
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
        </div>
      </div>

      <JournalDialog
        open={journalDialog.open}
        onOpenChange={(v) => setJournalDialog((s) => ({ ...s, open: v }))}
        entry={(journalDialog.date ?? todayISO) === todayISO ? todayEntry : recentJournal.find((j) => j.entry_date === journalDialog.date)}
        defaultDate={journalDialog.date ?? todayISO}
      />
    </>
  )
}

const SLOT_LABEL: Record<string, [string, string]> = {
  breakfast: ['Breakfast', '早餐'],
  lunch: ['Lunch', '午餐'],
  dinner: ['Dinner', '晚餐'],
  snack: ['Snack', '點心'],
}

/**
 * Today is a cross-space day (audit QW9): tasks due, habits left (at-risk
 * surfaced), and today's planned meals — every section hidden when empty, with
 * inline complete/check so the screen is actionable, not just a report.
 */
function TodayAcrossSpaces() {
  const { t } = useI18n()
  const todayIso = localTodayISO()
  // Shares cache keys with Tempo/Kitchen — no duplicate fetches once visited.
  const { data: tasks } = useTasks({ status: 'todo', limit: 500 })
  const { data: checkins } = useCheckInsInRange(addDaysIso(todayIso, -1), addDaysIso(todayIso, 1))
  const { data: meals = [] } = useMealPlans(todayIso, todayIso)
  const complete = useCompleteTask()
  const uncomplete = useUncompleteTask()

  const dueToday = todayTasks(tasks ?? [], todayIso).slice(0, 5)
  const done = new Set((checkins ?? []).map((c) => `${c.task_id}|${c.checkin_date}`))
  const habitsLeft = (tasks ?? [])
    .filter((h) => h.kind === 'habit' && !done.has(`${h.id}|${habitTodayISO(h.reset_time, h.tz)}`))
    .slice(0, 4)

  async function completeTask(task: TaskRow) {
    if (task.recurrence_rule) {
      // Same roll as Tempo's toggle; no Undo (uncomplete can't rewind the roll).
      const base = task.recurrence_after_completion
        ? todayIso
        : task.next_occurrence ?? task.due_date ?? task.scheduled_date ?? todayIso
      const next = await computeOccurrence(task.recurrence_rule, base, false)
      complete.mutate({ taskId: task.id, nextOccurrence: next ?? undefined })
    } else {
      complete.mutate({ taskId: task.id })
      toast(t('Completed', '已完成'), {
        action: { label: t('Undo', '復原'), onClick: () => uncomplete.mutate(task.id) },
        duration: 5000,
      })
    }
  }

  if (!dueToday.length && !habitsLeft.length && !meals.length) return null

  return (
    <section className="space-y-3">
      {dueToday.length ? (
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
      ) : null}

      {habitsLeft.length ? (
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
      ) : null}

      {meals.length ? (
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
              <span className="min-w-0 flex-1 truncate text-foreground">{p.title ?? '—'}</span>
            </div>
          ))}
        </div>
      ) : null}
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
