import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Pencil, Plus, Sparkles, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { humanizeError } from '@/lib/utils'
import type { ItineraryTree } from '@/lib/api'
import { useT } from '@/lib/i18n'
import { buildTripExport, diffTrip, parseTripDoc, planCounts, planIsEmpty } from '@/lib/trip-roundtrip'
import { applyTripPlan } from '@/lib/trip-roundtrip-apply'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Round-trip "edit this trip with AI" without any setup: copy the current trip
 * out as a fixed block, paste the AI's edited block back, preview the diff, and
 * apply it through the normal write path. No MCP/REST key needed.
 */
export function TripAiEditDialog({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  trip: ItineraryTree
}) {
  const t = useT()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const exportText = useMemo(() => buildTripExport(trip), [trip])
  const parsed = useMemo(() => (text.trim() ? parseTripDoc(text) : null), [text])
  const plan = useMemo(() => (parsed?.ok && parsed.data ? diffTrip(trip, parsed.data) : null), [parsed, trip])
  const counts = plan ? planCounts(plan) : null
  const empty = !plan || planIsEmpty(plan)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])

  async function copyExport() {
    await navigator.clipboard.writeText(exportText)
    setCopied(true)
    toast.success(t('Trip copied — paste it to your AI', '已複製行程 — 貼給你的 AI'))
  }

  async function apply() {
    if (!plan || planIsEmpty(plan)) return
    setBusy(true)
    try {
      await applyTripPlan(plan)
      await qc.invalidateQueries({ queryKey: ['itinerary', trip.id] })
      await qc.invalidateQueries({ queryKey: ['itineraries'] })
      const c = planCounts(plan)
      toast.success(
        t(
          `Applied — ${c.itemAdd + c.dayAdd} added, ${c.itemChange + c.dayChange} changed, ${c.itemRemove + c.dayRemove} removed`,
          `已套用 — 新增 ${c.itemAdd + c.dayAdd}、修改 ${c.itemChange + c.dayChange}、刪除 ${c.itemRemove + c.dayRemove}`,
        ),
      )
      setText('')
      onOpenChange(false)
    } catch (e) {
      toast.error(humanizeError(e, ['Failed to apply changes', '套用變更失敗']))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> {t('Edit this trip with AI', '用 AI 調整這個行程')}
          </DialogTitle>
          <DialogDescription>
            {t(
              'Copy your trip, paste it to any AI, say what to change, then paste its reply back — no setup needed.',
              '複製行程貼給任何 AI,說出要改什麼,再把它的回覆貼回來 —— 不用設定。',
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 — copy out */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-medium text-foreground">
              {t('1. Copy your current trip', '1. 複製目前的行程')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={copyExport}>
              {copied ? (
                <>
                  <Check className="size-3.5" /> {t('Copied', '已複製')}
                </>
              ) : (
                <>
                  <Copy className="size-3.5" /> {t('Copy', '複製')}
                </>
              )}
            </Button>
          </div>
          <pre className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            <code className="break-words">{exportText}</code>
          </pre>
        </div>

        {/* Step 2 — paste back */}
        <div className="space-y-2">
          <p className="text-[13px] font-medium text-foreground">
            {t('2. Paste the AI’s edited reply', '2. 貼上 AI 調整後的回覆')}
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('Paste the mnema-trip block here…', '在這裡貼上 mnema-trip 區塊…')}
            className="min-h-28 font-mono text-xs"
          />
          {parsed && !parsed.ok ? (
            <p className="flex items-start gap-1.5 text-[13px] text-amber-600">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {parsed.error}
            </p>
          ) : null}
        </div>

        {/* Step 3 — diff preview */}
        {counts ? (
          empty ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-[13px] text-muted-foreground">
              {t('No changes detected — this matches your current trip.', '沒有偵測到變更 —— 與目前行程相同。')}
            </p>
          ) : (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-[13px]">
              <p className="font-medium text-foreground">
                {t('Changes to apply', '即將套用的變更')}{' '}
                <span className="text-muted-foreground">
                  ({t('Days', '天數')} +{counts.dayAdd}/~{counts.dayChange}/−{counts.dayRemove} · {t('Items', '項目')} +
                  {counts.itemAdd}/~{counts.itemChange}/−{counts.itemRemove})
                </span>
              </p>
              <ul className="max-h-40 space-y-1 overflow-auto">
                {plan!.titleTo ? (
                  <DiffRow icon={<Pencil className="size-3.5" />}>
                    {t('Rename trip → ', '更名行程 → ')}
                    <span className="font-medium text-foreground">{plan!.titleTo}</span>
                  </DiffRow>
                ) : null}
                {plan!.dayCreates.map((d) => (
                  <DiffRow key={`dc${d.key}`} tone="add" icon={<Plus className="size-3.5" />}>
                    {t('Add day · ', '新增一天 · ')}
                    {d.preview}
                  </DiffRow>
                ))}
                {plan!.dayUpdates.map((d) => (
                  <DiffRow key={`du${d.id}`} icon={<Pencil className="size-3.5" />}>
                    {t('Edit day · ', '修改一天 · ')}
                    {d.preview}
                  </DiffRow>
                ))}
                {plan!.dayDeletes.map((d) => (
                  <DiffRow key={`dd${d.id}`} tone="del" icon={<Trash2 className="size-3.5" />}>
                    {t('Remove day · ', '刪除一天 · ')}
                    {d.preview}
                  </DiffRow>
                ))}
                {plan!.itemCreates.map((i) => (
                  <DiffRow key={`ic${i.key}`} tone="add" icon={<Plus className="size-3.5" />}>
                    {t('Add · ', '新增 · ')}
                    {i.preview}
                  </DiffRow>
                ))}
                {plan!.itemUpdates.map((i) => (
                  <DiffRow key={`iu${i.id}`} icon={<Pencil className="size-3.5" />}>
                    {t('Edit · ', '修改 · ')}
                    {i.preview}
                    {i.move ? <span className="text-muted-foreground"> · {t('moved', '移動')}</span> : null}
                  </DiffRow>
                ))}
                {plan!.itemDeletes.map((i) => (
                  <DiffRow key={`id${i.id}`} tone="del" icon={<Trash2 className="size-3.5" />}>
                    {t('Remove · ', '刪除 · ')}
                    {i.preview}
                  </DiffRow>
                ))}
              </ul>
            </div>
          )
        ) : null}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('Cancel', '取消')}
          </Button>
          <Button variant="brand" disabled={empty || busy} onClick={apply}>
            {busy ? (
              t('Applying…', '套用中…')
            ) : (
              <>
                <Sparkles className="size-4" /> {t('Apply changes', '套用變更')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DiffRow({ children, icon, tone }: { children: React.ReactNode; icon: React.ReactNode; tone?: 'add' | 'del' }) {
  const color = tone === 'del' ? 'text-destructive' : tone === 'add' ? 'text-brand' : 'text-muted-foreground'
  return (
    <li className="flex items-start gap-1.5">
      <span className={`mt-0.5 shrink-0 ${color}`}>{icon}</span>
      <span className="min-w-0 break-words text-foreground">{children}</span>
    </li>
  )
}
