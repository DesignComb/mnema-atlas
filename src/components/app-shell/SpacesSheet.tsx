import { Link, useRouterState } from '@tanstack/react-router'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SPACES, activeSpace } from './spaces'

/**
 * The mobile space switcher — every space (anchored or not) in one grid, reached
 * from the bottom bar's "Spaces" tab. A 7th/8th space just flows to a new row.
 * Reuses the bottom-sheet DialogContent (swipe-to-dismiss + safe-area for free).
 */
export function SpacesSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activeSpace(pathname)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('Spaces', '空間')}</DialogTitle>
          <DialogDescription className="sr-only">{t('Jump to a space', '切換到一個空間')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {SPACES.map((s) => {
            const isActive = active === s.key
            return (
              <Link
                key={s.key}
                to={s.to}
                onClick={() => onOpenChange(false)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-4 text-[12px] font-medium transition-colors',
                  isActive
                    ? 'border-brand/40 bg-brand-muted text-brand'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <s.icon className="size-6" />
                {t(s.en, s.zh)}
              </Link>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
