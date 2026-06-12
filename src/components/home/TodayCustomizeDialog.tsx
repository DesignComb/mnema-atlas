import { Eye, EyeOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SortableList } from '@/components/common/SortableList'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { LayoutSection } from '@/lib/today'

/** A layout entry plus its bilingual label, for the customize list. */
export interface CustomizableSection extends LayoutSection {
  en: string
  zh: string
}

/**
 * Reorder + hide the Today sections. Every change saves immediately through
 * `onChange` (an optimistic mutation upstream), so the screen behind the
 * dialog rearranges live — no Save button to forget.
 */
export function TodayCustomizeDialog({
  open,
  onOpenChange,
  sections,
  onChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  sections: CustomizableSection[]
  onChange: (next: LayoutSection[]) => void
}) {
  const t = useT()
  const byKey = new Map(sections.map((s) => [s.key, s]))
  const strip = (list: CustomizableSection[]): LayoutSection[] => list.map(({ key, hidden }) => ({ key, hidden }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Customise Today', '自訂「今天」')}</DialogTitle>
          <DialogDescription>
            {t(
              'Drag to reorder; hide what you don’t need. Sections with nothing to show stay out of the way on their own.',
              '拖曳排序，隱藏不需要的區塊。沒有內容的區塊本來就不會顯示。',
            )}
          </DialogDescription>
        </DialogHeader>

        <SortableList
          items={sections.map((s) => ({ id: s.key }))}
          onReorder={(ids) =>
            onChange(strip(ids.map((id) => byKey.get(id)).filter((s): s is CustomizableSection => Boolean(s))))
          }
          className="space-y-1"
          itemClassName="bg-background"
          renderItem={(item, handle) => {
            // Look the row up fresh — SortableList keeps its own order state, so
            // `item` can be stale after a visibility toggle (ids never change).
            const s = byKey.get(item.id)
            if (!s) return null
            return (
              <div className="group flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                {handle}
                <span className={cn('flex-1 text-sm', s.hidden && 'text-muted-foreground/60')}>{t(s.en, s.zh)}</span>
                <button
                  type="button"
                  onClick={() =>
                    onChange(strip(sections.map((x) => (x.key === s.key ? { ...x, hidden: !x.hidden } : x))))
                  }
                  aria-label={s.hidden ? t(`Show ${s.en}`, `顯示「${s.zh}」`) : t(`Hide ${s.en}`, `隱藏「${s.zh}」`)}
                  className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {s.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            )
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
