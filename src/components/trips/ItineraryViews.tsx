import { Fragment } from 'react'
import { MapPin } from 'lucide-react'
import type { ItineraryItem, ItineraryTree } from '@/lib/api'
import {
  CATEGORY_META,
  STATUS_META,
  STATUS_ORDER,
  categoryOf,
  fmtCost,
  fmtTimeRange,
  statusOf,
} from '@/lib/itinerary'
import { useT } from '@/lib/i18n'

type Tr = (en: string, zh: string) => string

function dayLabel(label: string | null, date: string | null, i: number, t: Tr): string {
  return label || date || t(`Day ${i + 1}`, `第 ${i + 1} 天`)
}

function StatusPill({ status, t }: { status: string; t: Tr }) {
  const s = STATUS_META[statusOf(status)]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${s.chip}`}>
      {t(s.en, s.zh)}
    </span>
  )
}

function CatPill({ category, t }: { category: string; t: Tr }) {
  const c = CATEGORY_META[categoryOf(category)]
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${c.chip}`}>
      <Icon className="size-3" /> {t(c.en, c.zh)}
    </span>
  )
}

// ─────────────────────────────── Table view ───────────────────────────────
export function ItineraryTable({
  trip,
  canEdit,
  onEdit,
}: {
  trip: ItineraryTree
  canEdit: boolean
  onEdit: (item: ItineraryItem) => void
}) {
  const t = useT()
  const groups: { key: string; label: string; items: ItineraryItem[] }[] = [
    ...trip.days.map((d, i) => ({ key: d.id, label: dayLabel(d.label, d.day_date, i, t), items: d.items })),
    ...(trip.unscheduled.length ? [{ key: 'unsch', label: t('Unscheduled', '未排程'), items: trip.unscheduled }] : []),
  ]
  const cols = [
    t('Time', '時間'),
    t('Activity', '活動'),
    t('Category', '分類'),
    t('Place', '地點'),
    t('Cost', '費用'),
    t('Status', '狀態'),
    t('Who', '同行'),
  ]
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
      <table className="w-full min-w-[680px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.key}>
              <tr className="bg-muted/40">
                <td colSpan={7} className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                  {g.label}
                </td>
              </tr>
              {g.items.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => canEdit && onEdit(item)}
                  className={`border-b border-border/50 last:border-0 ${canEdit ? 'cursor-pointer hover:bg-background' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-[12px] text-muted-foreground">
                    {fmtTimeRange(item.start_time, item.end_time, item.end_day_offset)}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">{item.title}</td>
                  <td className="px-3 py-2">
                    <CatPill category={item.category} t={t} />
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-muted-foreground">{item.place ?? ''}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {fmtCost(item.cost, item.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={item.status} t={t} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{item.assignees.join(' · ')}</td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────── Board view ───────────────────────────────
export function ItineraryBoard({
  trip,
  canEdit,
  onEdit,
}: {
  trip: ItineraryTree
  canEdit: boolean
  onEdit: (item: ItineraryItem) => void
}) {
  const t = useT()
  const all = [...trip.days.flatMap((d) => d.items), ...trip.unscheduled]
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {STATUS_ORDER.map((s) => {
        const meta = STATUS_META[s]
        const items = all.filter((i) => statusOf(i.status) === s)
        return (
          <div key={s} className="w-60 shrink-0">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className={`size-2 rounded-full ${meta.dot}`} />
              <span className="text-[13px] font-semibold text-foreground">{t(meta.en, meta.zh)}</span>
              <span className="text-[11px] text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((item) => {
                const c = CATEGORY_META[categoryOf(item.category)]
                const cost = fmtCost(item.cost, item.currency)
                const time = fmtTimeRange(item.start_time, item.end_time, item.end_day_offset)
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => onEdit(item)}
                    className="w-full rounded-lg border border-border bg-card p-2.5 text-left shadow-soft transition hover:border-brand/40 hover:shadow-pop disabled:cursor-default"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`size-2 shrink-0 rounded-full ${c.dot}`} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{item.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {time ? <span className="font-mono tabular-nums">{time}</span> : null}
                      {item.place ? (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="size-2.5" /> {item.place}
                        </span>
                      ) : null}
                      {cost ? <span className="tabular-nums">{cost}</span> : null}
                    </div>
                  </button>
                )
              })}
              {!items.length ? (
                <p className="rounded-lg border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground/60">
                  —
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
