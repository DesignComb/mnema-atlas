import { humanizeError } from '@/lib/utils'
import { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Activity,
  Check,
  HeartPulse,
  History,
  NotebookPen,
  Pencil,
  Pill,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  useHealthLogs,
  useHealthSettings,
  useJournalEntries,
  useLogHealth,
  useMedications,
  useReviewPrefs,
  useSetHealthSettings,
  useSetReviewPrefs,
} from '@/lib/hooks'
import {
  deleteHealthLog as apiDeleteHealthLog,
  deleteJournalEntry as apiDeleteJournalEntry,
  deleteMedication as apiDeleteMedication,
} from '@/lib/api'
import { undoableDelete, useHiddenKeys } from '@/lib/undoable'
import { useI18n, useT } from '@/lib/i18n'
import type { HealthLogKind, HealthModule } from '@shared/schemas'
import type { HealthLogRow, JournalEntryRow, MedicationRow } from '@/lib/database.types'
import {
  HEALTH_MODULES,
  MOOD_FACES,
  formatLogValue,
  kindMeta,
  kindsForModules,
  localTodayISO,
} from '@/lib/health'
import { PageHeader, EmptyState, ErrorState } from '@/components/app-shell/PageHeader'
import { AiChip, useNewSince } from '@/components/common/AiChip'
import { ConnectAiLink } from '@/components/common/ConnectAiLink'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { LogHealthDialog } from '@/components/health/LogHealthDialog'
import { JournalDialog } from '@/components/health/JournalDialog'
import { MedicationDialog } from '@/components/health/MedicationDialog'
import { PullToRefresh } from '@/lib/use-pull-to-refresh'

/** HH:MM (24h) of a timestamp, in local time. */
function hmOf(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Awaitable mirror of hooks.ts' bumpHealth, for undoable-delete onSettled. */
function bumpAllHealth(qc: QueryClient) {
  return Promise.all(
    ['health-logs', 'journal-entries', 'journal-entry', 'medications'].map((k) =>
      qc.invalidateQueries({ queryKey: [k] }),
    ),
  )
}

type Section = 'overview' | 'journal' | 'meds' | 'history' | 'settings'

const QUICK_KINDS: HealthLogKind[] = ['weight', 'meal', 'workout', 'water', 'sleep', 'blood_pressure']

export function HealthScreen() {
  const t = useT()
  const { lang } = useI18n()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { section?: Section }
  const section: Section = search.section ?? 'overview'

  const { data: settings } = useHealthSettings()
  const enabled = (settings?.enabled_modules ?? HEALTH_MODULES.map((m) => m.key)) as HealthModule[]
  const visibleKinds = useMemo(() => kindsForModules(enabled), [enabled])
  const hasJournal = enabled.includes('journal')
  const hasMeds = enabled.includes('meds')

  const qc = useQueryClient()
  const hiddenKeys = useHiddenKeys()
  const isNew = useNewSince('health')
  const { data: allLogs = [], isError: logsError, refetch: refetchLogs } = useHealthLogs({ limit: 200 })
  const { data: allJournal = [], isError: journalError, refetch: refetchJournal } = useJournalEntries()
  const { data: allMeds = [], isError: medsError, refetch: refetchMeds } = useMedications()
  // The active section's failed fetch must not render as "empty" (A5).
  const sectionError =
    section === 'journal' ? journalError : section === 'meds' ? medsError : logsError
  const sectionRetry = section === 'journal' ? refetchJournal : section === 'meds' ? refetchMeds : refetchLogs
  const logs = allLogs.filter((l) => !hiddenKeys.has(`hlog:${l.id}`))
  const journal = allJournal.filter((j) => !hiddenKeys.has(`journal:${j.id}`))
  const meds = allMeds.filter((m) => !hiddenKeys.has(`med:${m.id}`))

  const logHealth = useLogHealth()

  function removeHealthItem(key: string, message: string, commit: () => Promise<unknown>) {
    undoableDelete({
      key,
      message,
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Delete failed — the entry is back', '刪除失敗,紀錄已還原'),
      commit,
      onSettled: () => bumpAllHealth(qc),
    })
  }
  const setSettings = useSetHealthSettings()
  const { data: reviewPrefs } = useReviewPrefs()
  const setReviewPrefs = useSetReviewPrefs()

  const [logDialog, setLogDialog] = useState<{ open: boolean; kind?: HealthLogKind; log?: HealthLogRow }>({ open: false })
  const [journalDialog, setJournalDialog] = useState<{ open: boolean; entry?: JournalEntryRow }>({ open: false })
  const [medDialog, setMedDialog] = useState<{ open: boolean; medication?: MedicationRow }>({ open: false })
  const [histKind, setHistKind] = useState<string>('')

  const today = localTodayISO()
  const todayEntry = journal.find((j) => j.entry_date === today)
  const todayLogCount = logs.filter((l) => l.logged_date === today).length

  function setSection(s: Section) {
    navigate({ to: '/health', search: { section: s === 'overview' ? undefined : s }, replace: true })
  }

  const SECTIONS: { k: Section; en: string; zh: string; show: boolean }[] = [
    { k: 'overview', en: 'Overview', zh: '總覽', show: true },
    { k: 'journal', en: 'Journal', zh: '日記', show: hasJournal },
    { k: 'meds', en: 'Meds', zh: '用藥', show: hasMeds },
    { k: 'history', en: 'History', zh: '紀錄', show: true },
    { k: 'settings', en: 'Settings', zh: '設定', show: true },
  ]

  function fmtDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-GB', {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
  }

  const histLogs = histKind ? logs.filter((l) => l.kind === histKind) : logs

  return (
    <>
      <PageHeader
        title={t('Health', '健康')}
        icon={<HeartPulse className="size-4" />}
        actions={
          <Button variant="brand" size="sm" onClick={() => setLogDialog({ open: true })}>
            <Plus className="size-4" /> {t('Log', '記錄')}
          </Button>
        }
      />

      {/* Section tabs */}
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2 sm:px-6">
        {SECTIONS.filter((s) => s.show).map((s) => (
          <button
            key={s.k}
            onClick={() => setSection(s.k)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
              section === s.k ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t(s.en, s.zh)}
          </button>
        ))}
      </div>

      <PullToRefresh onRefresh={() => bumpAllHealth(qc)}>
        <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
          {sectionError && section !== 'settings' ? <ErrorState onRetry={() => void sectionRetry()} /> : null}
          {/* ── Overview ───────────────────────────────────────────── */}
          {section === 'overview' && !sectionError ? (
            <div className="flex flex-col gap-5">
              {hasJournal ? (
                <button
                  onClick={() => setJournalDialog({ open: true, entry: todayEntry })}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition hover:border-brand/40"
                >
                  <span className="text-3xl">{todayEntry?.mood ? MOOD_FACES[todayEntry.mood - 1] : '📝'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t('How was today?', '今天如何?')}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {todayEntry
                        ? todayEntry.body || t('Tap to add more', '點一下補充')
                        : t('Log your mood and a few words', '記下心情與幾句話')}
                    </p>
                  </div>
                </button>
              ) : null}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {t('Quick log', '快速記錄')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_KINDS.filter((k) => visibleKinds.some((v) => v.kind === k)).map((k) => {
                    const meta = kindMeta(k)!
                    return (
                      <button
                        key={k}
                        onClick={() => setLogDialog({ open: true, kind: k })}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] text-foreground transition hover:border-brand/50 hover:text-brand"
                      >
                        {t(meta.en, meta.zh)}
                      </button>
                    )
                  })}
                </div>
              </div>

              {hasMeds && meds.filter((m) => m.is_active).length ? (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    {t('Medications today', '今日用藥')}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {meds
                      .filter((m) => m.is_active)
                      .map((m) => {
                        // Each scheduled time is its own dose — "took the morning one"
                        // must not read as done for the evening one (A9).
                        const takenCount = logs.filter(
                          (l) => l.kind === 'meds' && l.logged_date === today && l.text_value === m.name,
                        ).length
                        const totalDoses = Math.max(m.times.length, 1)
                        const allTaken = takenCount >= totalDoses
                        const nowHM = hmOf(new Date().toISOString())
                        const dueByNow = m.times.filter((x) => x.slice(0, 5) <= nowHM).length
                        const overdue = !allTaken && takenCount < dueByNow
                        return (
                          <div
                            key={m.id}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                              overdue ? 'border-warning/60 bg-warning-muted/50' : 'border-border bg-card'
                            }`}
                          >
                            <Pill className={`size-4 shrink-0 ${overdue ? 'text-warning' : 'text-muted-foreground'}`} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13.5px] font-medium text-foreground">
                                {m.name}
                                {totalDoses > 1 ? (
                                  <span className="ml-1.5 tabular-nums text-[12px] font-normal text-muted-foreground">
                                    {takenCount}/{totalDoses}
                                  </span>
                                ) : null}
                              </p>
                              <p className="truncate text-[12px] text-muted-foreground">
                                {m.dosage ? <span>{m.dosage}</span> : null}
                                {m.times.map((x, i) => (
                                  <span
                                    key={`${x}-${i}`}
                                    className={`ml-1.5 tabular-nums first:ml-0 ${
                                      i < takenCount
                                        ? 'text-success line-through'
                                        : x.slice(0, 5) <= nowHM
                                          ? 'font-medium text-warning'
                                          : ''
                                    }`}
                                  >
                                    {x.slice(0, 5)}
                                  </span>
                                ))}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant={allTaken ? 'ghost' : 'brand'}
                              disabled={allTaken || logHealth.isPending}
                              onClick={() =>
                                logHealth.mutate(
                                  { kind: 'meds', text_value: m.name },
                                  { onError: (e) => toast.error(humanizeError(e, ['Failed to log', '記錄失敗'])) },
                                )
                              }
                            >
                              <Check className="size-4" /> {allTaken ? t('Taken', '已服') : t('Take', '服用')}
                            </Button>
                          </div>
                        )
                      })}
                  </div>
                </div>
              ) : null}

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {t('Recent', '最近')} {todayLogCount ? `· ${t(`${todayLogCount} today`, `今天 ${todayLogCount} 筆`)}` : ''}
                </p>
                {logs.length ? (
                  <LogList
                    logs={logs.slice(0, 12)}
                    fmtDate={fmtDate}
                    onEdit={(log) => setLogDialog({ open: true, log })}
                    onDelete={(id) => removeHealthItem(`hlog:${id}`, t('Entry deleted', '已刪除紀錄'), () => apiDeleteHealthLog(id))}
                    t={t}
                    isNew={isNew}
                  />
                ) : (
                  <EmptyState
                    icon={<Activity className="size-5" />}
                    title={t('Nothing logged yet', '還沒有任何紀錄')}
                    description={t('Tap “Log”, or just tell your AI — “午餐吃了雞腿便當”.', '點「記錄」,或直接跟你的 AI 說「午餐吃了雞腿便當」。')}
                    action={
                      <div className="flex flex-col items-center gap-2">
                        <Button variant="brand" size="sm" onClick={() => setLogDialog({ open: true })}>
                          <Plus className="size-4" /> {t('Log health', '記錄健康')}
                        </Button>
                        <ConnectAiLink />
                      </div>
                    }
                  />
                )}
              </div>
            </div>
          ) : null}

          {/* ── Journal ────────────────────────────────────────────── */}
          {section === 'journal' && !sectionError ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <Button variant="brand" size="sm" onClick={() => setJournalDialog({ open: true, entry: todayEntry })}>
                  <NotebookPen className="size-4" /> {t('Today', '今天')}
                </Button>
              </div>
              {journal.length ? (
                journal.map((j) => (
                  <div key={j.id} className="group rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{j.mood ? MOOD_FACES[j.mood - 1] : '·'}</span>
                      <span className="text-[13px] font-semibold text-foreground">{fmtDate(j.entry_date)}</span>
                      {j.energy ? <span className="text-[12px] text-muted-foreground">{t('Energy', '精力')} {j.energy}/5</span> : null}
                      <div className="ml-auto flex gap-1 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                        <button onClick={() => setJournalDialog({ open: true, entry: j })} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => removeHealthItem(`journal:${j.id}`, t('Journal entry deleted', '已刪除日記'), () => apiDeleteJournalEntry(j.id))}
                          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                          aria-label={t('Delete', '刪除')}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {j.body ? <p className="mt-1.5 whitespace-pre-wrap text-[13.5px] leading-relaxed text-foreground">{j.body}</p> : null}
                    {j.tags.length ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {j.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-brand-muted px-2 py-0.5 text-[11px] text-brand">{tag}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={<NotebookPen className="size-5" />}
                  title={t('No journal entries yet', '還沒有日記')}
                  description={t('Reflect on your day — mood, energy, a few words.', '記下今天的心情、精力與幾句話。')}
                  action={
                    <Button variant="brand" size="sm" onClick={() => setJournalDialog({ open: true, entry: todayEntry })}>
                      <NotebookPen className="size-4" /> {t('Write today', '寫今天')}
                    </Button>
                  }
                />
              )}
            </div>
          ) : null}

          {/* ── Medications ────────────────────────────────────────── */}
          {section === 'meds' && !sectionError ? (
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <Button variant="brand" size="sm" onClick={() => setMedDialog({ open: true })}>
                  <Plus className="size-4" /> {t('Add medication', '新增用藥')}
                </Button>
              </div>
              {meds.length ? (
                meds.map((m) => (
                  <div key={m.id} className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                    <Pill className={`size-5 shrink-0 ${m.is_active ? 'text-brand' : 'text-muted-foreground/50'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-foreground">{m.name}{!m.is_active ? <span className="ml-2 text-[11px] text-muted-foreground">{t('inactive', '停用')}</span> : null}</p>
                      <p className="truncate text-[12.5px] text-muted-foreground">{[m.dosage, m.times.join(' · ')].filter(Boolean).join(' · ') || t('No schedule', '無排程')}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <button onClick={() => setMedDialog({ open: true, medication: m })} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
                        <Pencil className="size-4" />
                      </button>
                      <button
                        onClick={() => removeHealthItem(`med:${m.id}`, t(`Deleted “${m.name}”`, `已刪除「${m.name}」`), () => apiDeleteMedication(m.id))}
                        className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label={t('Delete', '刪除')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  icon={<Pill className="size-5" />}
                  title={t('No medications yet', '還沒有用藥')}
                  description={t('Track what you take and when.', '記下你在吃的藥與時間。')}
                  action={
                    <Button variant="brand" size="sm" onClick={() => setMedDialog({ open: true })}>
                      <Plus className="size-4" /> {t('Add medication', '新增用藥')}
                    </Button>
                  }
                />
              )}
            </div>
          ) : null}

          {/* ── History ────────────────────────────────────────────── */}
          {section === 'history' && !sectionError ? (
            <div className="flex flex-col gap-3">
              <Select value={histKind} onChange={(e) => setHistKind(e.target.value)} className="w-52">
                <option value="">{t('All metrics', '所有項目')}</option>
                {visibleKinds.map((k) => (
                  <option key={k.kind} value={k.kind}>{t(k.en, k.zh)}</option>
                ))}
              </Select>
              {histLogs.length ? (
                <LogList
                  logs={histLogs}
                  fmtDate={fmtDate}
                  onEdit={(log) => setLogDialog({ open: true, log })}
                  onDelete={(id) => removeHealthItem(`hlog:${id}`, t('Entry deleted', '已刪除紀錄'), () => apiDeleteHealthLog(id))}
                  t={t}
                  isNew={isNew}
                />
              ) : (
                <EmptyState icon={<History className="size-5" />} title={t('No entries', '沒有紀錄')} />
              )}
            </div>
          ) : null}

          {/* ── Settings ───────────────────────────────────────────── */}
          {section === 'settings' ? (
            <div className="flex flex-col gap-5">
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">{t('Modules', '模組')}</p>
                <p className="mb-3 text-[13px] text-muted-foreground">{t('Show only the things you want to track.', '只顯示你想追蹤的項目。')}</p>
                <div className="flex flex-col gap-2">
                  {HEALTH_MODULES.map((m) => {
                    const on = enabled.includes(m.key)
                    return (
                      <label key={m.key} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...enabled, m.key]
                              : enabled.filter((x) => x !== m.key)
                            setSettings.mutate(
                              { enabled_modules: next },
                              { onError: (err) => toast.error(humanizeError(err)) },
                            )
                          }}
                          className="size-4 accent-[var(--brand)]"
                        />
                        <span className="text-[13.5px] text-foreground">{t(m.en, m.zh)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-foreground">{t('Weight unit', '體重單位')}</p>
                <Select
                  value={settings?.weight_unit ?? 'kg'}
                  onChange={(e) => setSettings.mutate({ weight_unit: e.target.value as 'kg' | 'lb' })}
                  className="w-32"
                >
                  <option value="kg">kg</option>
                  <option value="lb">lb</option>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-foreground">{t('Daily review', '每日回顧')}</p>
                <p className="mb-3 text-[13px] text-muted-foreground">
                  {t(
                    'In the evening, get nudged to log your mood and reflect on the day.',
                    '晚上提醒你記下心情、回顧今天。',
                  )}
                </p>
                <label className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={reviewPrefs?.is_enabled ?? false}
                    onChange={(e) => setReviewPrefs.mutate(e.target.checked, { onError: (err) => toast.error(humanizeError(err)) })}
                    className="size-4 accent-[var(--brand)]"
                  />
                  <span className="text-[13.5px] text-foreground">{t('Remind me each evening', '每天晚上提醒我')}</span>
                </label>
                <p className="mt-2 text-[11px] text-muted-foreground/80">
                  {t('Push needs to be enabled once in Settings → Reminders.', '推播需先在「設定 → 提醒」開啟一次。')}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </PullToRefresh>

      <LogHealthDialog
        open={logDialog.open}
        onOpenChange={(v) => setLogDialog((s) => ({ ...s, open: v }))}
        kinds={visibleKinds}
        defaultKind={logDialog.kind}
        log={logDialog.log}
        weightUnit={settings?.weight_unit ?? 'kg'}
      />
      <JournalDialog open={journalDialog.open} onOpenChange={(v) => setJournalDialog((s) => ({ ...s, open: v }))} entry={journalDialog.entry} />
      <MedicationDialog open={medDialog.open} onOpenChange={(v) => setMedDialog((s) => ({ ...s, open: v }))} medication={medDialog.medication} />
    </>
  )
}

function LogList({
  logs,
  fmtDate,
  onEdit,
  onDelete,
  t,
  isNew,
}: {
  logs: HealthLogRow[]
  fmtDate: (iso: string) => string
  onEdit: (log: HealthLogRow) => void
  onDelete: (id: string) => void
  t: (en: string, zh: string) => string
  isNew?: (createdAt: string | null | undefined) => boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {logs.map((l) => {
        const meta = kindMeta(l.kind)
        return (
          <div key={l.id} className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-[13.5px] text-foreground">
                <span className="font-medium">{meta ? t(meta.en, meta.zh) : l.kind}</span>
                <span className="truncate text-muted-foreground">· {formatLogValue(l)}</span>
                {l.created_via === 'mcp' ? <AiChip isNew={isNew?.(l.created_at)} /> : null}
              </p>
              {l.note ? <p className="truncate text-[12px] text-muted-foreground">{l.note}</p> : null}
            </div>
            <span className="shrink-0 text-[11.5px] tabular-nums text-muted-foreground">
              {fmtDate(l.logged_date)} {hmOf(l.logged_at)}
            </span>
            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
              <button onClick={() => onEdit(l)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={() => onDelete(l.id)} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
