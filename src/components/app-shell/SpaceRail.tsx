import { Link, useRouterState } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { BRAND_ICON, SPACES, activeSpace } from './spaces'

/** Desktop (lg+) far-left rail: the 4 spaces always visible, 1 tap to switch,
 *  plus the global Capture button. Active item uses the space's brand hue. */
export function SpaceRail({ onCapture }: { onCapture: () => void }) {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activeSpace(pathname)

  return (
    <nav
      aria-label={t('Spaces', '空間')}
      data-tour="spaces"
      className="hidden w-16 shrink-0 flex-col items-center gap-1.5 border-r border-sidebar-border bg-sidebar py-3 lg:flex"
    >
      <Link
        to="/today"
        aria-label="Mnema"
        className="mb-1 flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm"
      >
        <BRAND_ICON className="size-5" />
      </Link>

      {SPACES.map((s) => {
        const isActive = active === s.key
        return (
          <Link
            key={s.key}
            to={s.to}
            title={t(s.en, s.zh)}
            aria-label={t(s.en, s.zh)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[9px] font-medium transition-colors',
              isActive
                ? 'bg-brand-muted text-brand'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
            )}
          >
            <s.icon className="size-[18px]" />
            <span>{t(s.en, s.zh)}</span>
          </Link>
        )
      })}

      <button
        onClick={onCapture}
        data-tour="capture"
        title={t('Capture', '暫存')}
        aria-label={t('Capture anything for your AI', '隨手暫存,交給 AI')}
        className="mt-1 flex size-11 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border text-[9px] font-medium text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
      >
        <Plus className="size-[18px]" />
        <span>{t('Add', '暫存')}</span>
      </button>
    </nav>
  )
}
