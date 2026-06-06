import { Link, useRouterState } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SPACES, activeSpace } from './spaces'

/** Mobile (<lg) bottom tab bar: the 4 spaces + a global Capture button, all one
 *  tap away. The per-space lists/views still live in the hamburger drawer. */
export function BottomTabs({ onCapture }: { onCapture: () => void }) {
  const t = useT()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const active = activeSpace(pathname)

  const item = 'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium'

  return (
    <nav
      aria-label={t('Spaces', '空間')}
      className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-sidebar-border bg-sidebar/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {SPACES.map((s) => {
        const isActive = active === s.key
        return (
          <Link
            key={s.key}
            to={s.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(item, isActive ? 'text-brand' : 'text-muted-foreground')}
          >
            <s.icon className="size-5" />
            <span>{t(s.en, s.zh)}</span>
          </Link>
        )
      })}
      <button onClick={onCapture} aria-label={t('Capture anything for your AI', '隨手暫存,交給 AI')} className={cn(item, 'text-muted-foreground')}>
        <Plus className="size-5" />
        <span>{t('Add', '暫存')}</span>
      </button>
    </nav>
  )
}
