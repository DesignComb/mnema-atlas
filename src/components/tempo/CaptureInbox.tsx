import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, RotateCcw, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCaptures,
  useCreateCapture,
  useDismissCapture,
  useReopenCapture,
} from '@/lib/hooks'
import { deleteCapture as apiDeleteCapture } from '@/lib/api'
import { undoableDelete, useHiddenKeys } from '@/lib/undoable'
import { useT } from '@/lib/i18n'
import type { CaptureStatus } from '@/lib/api'
import type { CaptureRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/app-shell/PageHeader'

// What the user tells their own AI to run the triage flow (tool descriptions do the rest).
const TRIGGER_EN = 'process my inbox'
const TRIGGER_ZH = '處理我的暫存區'

const SOURCE_LABEL: Record<string, [string, string]> = {
  ui: ['typed', '手動'],
  share: ['shared', '分享'],
  mcp: ['AI', 'AI'],
  rest: ['API', 'API'],
}

/** What a capture became after triage (A6) — localized; unknown kinds fall through raw. */
const RESOLVED_KIND_LABEL: Record<string, [string, string]> = {
  task: ['task', '任務'],
  habit: ['habit', '習慣'],
  note: ['note', '筆記'],
  card: ['flashcard', '字卡'],
  transaction: ['transaction', '記帳'],
  itinerary: ['trip', '行程'],
  event: ['event', '行事曆'],
  reminder: ['reminder', '提醒'],
  recipe: ['recipe', '食譜'],
  health_log: ['health log', '健康紀錄'],
  journal: ['journal', '日記'],
}

// Locale-free MM/DD HH:MM so we never touch OS locale formatting.
function shortStamp(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function CaptureInbox({
  sharedText,
  onConsumeShared,
}: {
  sharedText?: string
  onConsumeShared: () => void
}) {
  const t = useT()
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<CaptureStatus>('pending')
  const { data: captures, isLoading } = useCaptures(filter)
  const create = useCreateCapture()
  const dismiss = useDismissCapture()
  const reopen = useReopenCapture()
  const qc = useQueryClient()
  const hiddenKeys = useHiddenKeys()
  const [copied, setCopied] = useState(false)

  // PWA share-target & quick links land at ?capture=… — file it once, then clear the param.
  useEffect(() => {
    const text = sharedText?.trim()
    if (!text) return
    onConsumeShared()
    create.mutate(
      { raw_text: text, source: 'share' },
      {
        onSuccess: () => toast.success(t('Added to your inbox', '已加入暫存區')),
        onError: (e) => toast.error(e instanceof Error ? e.message : t('Failed to capture', '暫存失敗')),
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedText])

  async function save() {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    try {
      await create.mutateAsync({ raw_text: text, source: 'ui' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed to capture', '暫存失敗'))
    }
  }

  async function copyTrigger() {
    await navigator.clipboard.writeText(t(TRIGGER_EN, TRIGGER_ZH))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const rows = ((captures ?? []) as CaptureRow[]).filter((c) => !hiddenKeys.has(`capture:${c.id}`))
  const pendingCount = filter === 'pending' ? rows.length : null

  function removeCapture(c: CaptureRow) {
    undoableDelete({
      key: `capture:${c.id}`,
      message: t('Capture deleted', '已刪除暫存'),
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Delete failed — the capture is back', '刪除失敗,暫存已還原'),
      commit: () => apiDeleteCapture(c.id),
      onSettled: () => qc.invalidateQueries({ queryKey: ['captures'] }),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
        {/* Quick capture */}
        <div className="mb-3 rounded-xl border border-border bg-card p-3 shadow-soft focus-within:border-brand/50">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter saves; Shift+Enter for a newline.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void save()
              }
            }}
            rows={2}
            placeholder={t(
              'Jot anything — “buy milk”, “book a dentist appt”, “gym at 19:00…”. File it later with your AI.',
              '隨手記任何事 —— 「買牛奶」「預約看牙」「19:00 健身…」。之後再讓 AI 歸檔。',
            )}
            className="min-h-0 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground/70">{t('Enter to save · Shift+Enter for a new line', 'Enter 儲存 · Shift+Enter 換行')}</span>
            <Button variant="brand" size="sm" onClick={() => void save()} disabled={!draft.trim() || create.isPending}>
              {t('Capture', '暫存')}
            </Button>
          </div>
        </div>

        {/* How the triage works — the conversation lives in the user's own AI. */}
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-brand/30 bg-brand-muted/40 p-3 text-[12.5px] leading-relaxed text-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p>
              {t(
                'Capture loose thoughts here on the go. When you’re back, tell your connected AI to sort them — it reads each one, files it into the right space, asks only what it needs (a time? repeat?), and clears the inbox.',
                '在外面把零碎想法先丟這裡。回來後叫你連接的 AI 整理 —— 它會逐筆讀、歸到正確的地方、只問必要的(要時間?要重複?),然後清空暫存區。',
              )}
            </p>
            <button
              onClick={copyTrigger}
              className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 font-mono text-[12px] text-brand transition hover:border-brand/50"
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {t(TRIGGER_EN, TRIGGER_ZH)}
            </button>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-2 flex gap-1 text-[12px]">
          {(['pending', 'processed', 'dismissed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-md px-2 py-1 font-medium transition ${
                filter === s ? 'bg-brand-muted text-brand' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(
                s === 'pending' ? 'Pending' : s === 'processed' ? 'Filed' : 'Dismissed',
                s === 'pending' ? '待處理' : s === 'processed' ? '已歸檔' : '已忽略',
              )}
              {s === 'pending' && pendingCount ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-card" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title={filter === 'pending' ? t('Inbox zero', '暫存區清空了') : t('Nothing here', '這裡沒有東西')}
            description={
              filter === 'pending'
                ? t('Jot something above, or share text into Mnema from any app.', '在上方隨手記,或從任何 App 把文字分享進 Mnema。')
                : t('Switch back to Pending to see what’s waiting.', '切回「待處理」看還有什麼在排隊。')
            }
          />
        ) : (
          <div className="space-y-2">
            {rows.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap break-words text-[14px] text-foreground">{c.raw_text}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{shortStamp(c.created_at)}</span>
                    <span>·</span>
                    <span>{t(...(SOURCE_LABEL[c.source] ?? [c.source, c.source]))}</span>
                    {c.resolved_kind ? (
                      <>
                        <span>·</span>
                        <span className="text-brand">
                          → {t(...(RESOLVED_KIND_LABEL[c.resolved_kind] ?? [c.resolved_kind, c.resolved_kind]))}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {filter === 'pending' ? (
                    <button
                      onClick={() => dismiss.mutate(c.id)}
                      className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title={t('Dismiss', '忽略')}
                      aria-label={t('Dismiss', '忽略')}
                    >
                      <X className="size-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => reopen.mutate(c.id)}
                      className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title={t('Reopen', '重新開啟')}
                      aria-label={t('Reopen', '重新開啟')}
                    >
                      <RotateCcw className="size-4" />
                    </button>
                  )}
                  <button
                    onClick={() => removeCapture(c)}
                    className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                    title={t('Delete', '刪除')}
                    aria-label={t('Delete', '刪除')}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
