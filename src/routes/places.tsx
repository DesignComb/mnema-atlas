import { useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Check, ExternalLink, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import { usePlaces, useUpdatePlace, useDeletePlace } from '@/lib/hooks'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { PlaceDialog } from '@/components/places/PlaceDialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { tagColor, tagChipStyle } from '@/lib/tags'
import { safeHttps } from '@/lib/itinerary'
import { undoableDelete, useHiddenKeys } from '@/lib/undoable'
import { useI18n } from '@/lib/i18n'
import { useTheme } from '@/lib/theme'
import type { PlaceRow } from '@/lib/database.types'

export function PlacesScreen() {
  const { data: places, isLoading } = usePlaces()
  const updatePlace = useUpdatePlace()
  const deletePlace = useDeletePlace()
  const hidden = useHiddenKeys()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [dialog, setDialog] = useState<{ open: boolean; place?: PlaceRow }>({ open: false })

  // Selected tag filter (in the URL so it's shareable / survives refresh).
  const { tag: activeTag } = useSearch({ from: '/_app/places' }) as { tag?: string }
  const selectTag = (tg: string | undefined) => navigate({ to: '/places', search: tg ? { tag: tg } : {} })

  const visible = (places ?? []).filter((p) => !hidden.has(`place:${p.id}`))

  // All tags + counts, for the filter chip row.
  const tagCount = new Map<string, number>()
  visible.forEach((p) => p.tags?.forEach((tg) => tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1)))
  const tagList = [...tagCount.keys()].sort((a, b) => a.localeCompare(b))
  const tagSuggestions = tagList

  const filtered = activeTag ? visible.filter((p) => p.tags?.includes(activeTag)) : visible

  function toggleVisited(p: PlaceRow) {
    updatePlace.mutate({ place_id: p.id, visited: !p.visited })
  }
  function removePlace(p: PlaceRow) {
    undoableDelete({
      key: `place:${p.id}`,
      message: t('Place deleted', '已刪除地點'),
      undoLabel: t('Undo', '復原'),
      errorMessage: t('Failed to delete', '刪除失敗'),
      commit: () => deletePlace.mutateAsync(p.id),
    })
  }

  return (
    <>
      <PageHeader
        title={t('Places', '想去')}
        subtitle={
          places ? t(`${visible.length} place${visible.length === 1 ? '' : 's'}`, `${visible.length} 個地點`) : undefined
        }
        actions={
          <Button variant="brand" size="sm" onClick={() => setDialog({ open: true })}>
            <Plus className="size-4" /> <span className="hidden sm:inline">{t('New place', '新增地點')}</span>
          </Button>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          {/* Filter by tag — click a tag to see only its places. */}
          {tagList.length ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {tagList.map((tg) => {
                const active = tg === activeTag
                return (
                  <button
                    key={tg}
                    type="button"
                    onClick={() => selectTag(active ? undefined : tg)}
                    aria-pressed={active}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium outline-none transition hover:opacity-85 focus-visible:ring-2 focus-visible:ring-ring/50',
                      active
                        ? 'border-brand/40 ring-1 ring-brand/30 text-foreground'
                        : 'border-border text-muted-foreground hover:border-brand/40 hover:text-foreground',
                    )}
                    title={t(`Filter “${tg}”`, `篩選「${tg}」`)}
                  >
                    <span className="size-2 rounded-full" style={{ background: tagColor(tg) }} />
                    {tg}
                    <span className="tabular-nums opacity-70">{tagCount.get(tg) ?? 0}</span>
                    {active ? <X className="size-3" /> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-card/60" />
              ))}
            </div>
          ) : filtered.length ? (
            <div className="grid gap-2">
              {filtered.map((p) => (
                <PlaceCard
                  key={p.id}
                  p={p}
                  isDark={isDark}
                  onToggleVisited={() => toggleVisited(p)}
                  onEdit={() => setDialog({ open: true, place: p })}
                  onDelete={() => removePlace(p)}
                />
              ))}
            </div>
          ) : activeTag ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-4 text-[13px] text-muted-foreground">
              {t('No places with this tag.', '沒有帶此標籤的地點。')}
            </p>
          ) : (
            <EmptyState
              icon={<MapPin className="size-6" />}
              title={t('No places yet', '還沒有想去的地點')}
              description={t(
                'Save shops and sights you want to visit, and tag them by area or kind (台南東區 / 甜點) to find them fast.',
                '把想去的店家與景點記下來，用區域或類型標籤（台南東區／甜點）分類，之後好找。',
              )}
              action={
                <Button variant="brand" size="sm" onClick={() => setDialog({ open: true })}>
                  <Plus className="size-4" /> {t('New place', '新增地點')}
                </Button>
              }
            />
          )}
        </div>
      </div>
      <PlaceDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        place={dialog.place}
        tagSuggestions={tagSuggestions}
      />
    </>
  )
}

function PlaceCard({
  p,
  isDark,
  onToggleVisited,
  onEdit,
  onDelete,
}: {
  p: PlaceRow
  isDark: boolean
  onToggleVisited: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useI18n()
  const link = safeHttps(p.url)

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-soft transition hover:border-brand/40 hover:shadow-pop">
      <button
        type="button"
        aria-pressed={p.visited}
        onClick={onToggleVisited}
        title={p.visited ? t('Mark as want to go', '標記為想去') : t('Mark as been', '標記為已去過')}
        aria-label={p.visited ? t('Mark as want to go', '標記為想去') : t('Mark as been', '標記為已去過')}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition',
          p.visited
            ? 'border-brand bg-brand text-brand-foreground'
            : 'border-muted-foreground/40 text-transparent hover:border-brand',
        )}
      >
        <Check className="size-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium text-foreground', p.visited && 'text-muted-foreground line-through')}>
          {p.name}
        </p>
        {p.tags?.length ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {p.tags.map((tg) => (
              <span
                key={tg}
                style={tagChipStyle(tg, isDark)}
                className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
              >
                {tg}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-muted-foreground">
          {p.address ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3" /> {p.address}
            </span>
          ) : null}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition hover:text-brand"
            >
              <ExternalLink className="size-3" /> {t('Open', '開啟')}
            </a>
          ) : null}
        </div>
        {p.note ? <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">{p.note}</p> : null}
      </div>
      <div className="flex shrink-0 gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          title={t('Edit', '編輯')}
          aria-label={t('Edit place', '編輯地點')}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title={t('Delete', '刪除')}
          aria-label={t('Delete place', '刪除地點')}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-accent hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </div>
  )
}
