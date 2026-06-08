import { Plus, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { MAX_PINNED, setPinnedSpaces, usePinnedSpaces } from '@/lib/pinned-spaces'
import { SortableList } from '@/components/common/SortableList'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SPACES, type SpaceKey } from './spaces'

/**
 * Let the user choose which spaces sit on the mobile bottom bar (max 4) and
 * reorder them. Opened by long-pressing the bar. Pinned spaces drag to reorder;
 * the rest live here and in the ☰ drawer.
 */
export function BottomTabsCustomize({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useT()
  const pinned = usePinnedSpaces()

  const pinnedItems = pinned
    .map((key) => SPACES.find((s) => s.key === key))
    .filter((s): s is (typeof SPACES)[number] => Boolean(s))
    .map((s) => ({ ...s, id: s.key }))

  const others = SPACES.filter((s) => !pinned.includes(s.key))
  const atMax = pinned.length >= MAX_PINNED

  const unpin = (key: SpaceKey) => setPinnedSpaces(pinned.filter((k) => k !== key))
  const pin = (key: SpaceKey) => {
    if (atMax) return
    setPinnedSpaces([...pinned, key])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Customise bottom bar', '自訂底部列')}</DialogTitle>
          <DialogDescription>
            {t(`Pin up to ${MAX_PINNED} spaces; drag to reorder. The rest stay in the ☰ drawer.`, `最多 pin ${MAX_PINNED} 個空間，拖曳排序。其餘留在 ☰ 抽屜裡。`)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('On the bar', '底部列')}</p>
            {pinnedItems.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                {t('Nothing pinned yet — add some below.', '還沒 pin 任何空間 — 從下面加入。')}
              </p>
            ) : (
              <SortableList
                items={pinnedItems}
                onReorder={(ids) => setPinnedSpaces(ids as SpaceKey[])}
                className="space-y-1"
                itemClassName="bg-background"
                renderItem={(item, handle) => (
                  <div className="group flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                    {handle}
                    <item.icon className="size-4 text-brand" />
                    <span className="flex-1 text-sm">{t(item.en, item.zh)}</span>
                    <button
                      type="button"
                      onClick={() => unpin(item.key)}
                      aria-label={t(`Remove ${item.en}`, `移除 ${item.zh}`)}
                      className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                )}
              />
            )}
          </div>

          {others.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t('More spaces', '其他空間')}</p>
              <div className="space-y-1">
                {others.map((s) => (
                  <div key={s.key} className="flex items-center gap-2 rounded-lg border border-border px-2 py-2">
                    <s.icon className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-sm">{t(s.en, s.zh)}</span>
                    <button
                      type="button"
                      onClick={() => pin(s.key)}
                      disabled={atMax}
                      aria-label={t(`Pin ${s.en}`, `加入 ${s.zh}`)}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition',
                        atMax ? 'cursor-not-allowed text-muted-foreground/50' : 'text-brand hover:bg-brand-muted',
                      )}
                    >
                      <Plus className="size-3.5" />
                      {t('Pin', '加入')}
                    </button>
                  </div>
                ))}
              </div>
              {atMax && <p className="mt-1.5 text-xs text-muted-foreground">{t(`Bar is full (${MAX_PINNED}). Remove one to add another.`, `底部列已滿（${MAX_PINNED} 個），移除一個才能再加。`)}</p>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
