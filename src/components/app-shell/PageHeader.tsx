import { useSyncExternalStore, type ReactNode } from 'react'
import { CloudOff, Menu, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobileNav } from '@/lib/mobile-nav'
import { useT } from '@/lib/i18n'

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}) {
  const { openNav } = useMobileNav()
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3 sm:gap-3 sm:px-6">
      {/* Mobile: opens the nav drawer. Hidden once the sidebar is persistent (lg+). */}
      <button
        type="button"
        onClick={openNav}
        aria-label="Open menu"
        className="-ml-1 shrink-0 rounded-md p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
      >
        <Menu className="size-5" />
      </button>
      {icon ? <span className="hidden text-muted-foreground sm:block">{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">{actions}</div> : null}
    </header>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center sm:px-6 sm:py-16', className)}>
      {icon ? (
        <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-muted text-brand">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}
function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

/**
 * A failed fetch must never masquerade as an empty state (audit A5) — "couldn't
 * load" and "you have none yet" are different facts. Calm card + Retry, and an
 * honest offline line when that's the actual cause.
 */
export function ErrorState({ onRetry, className }: { onRetry?: () => void; className?: string }) {
  const t = useT()
  const online = useOnline()
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-4 py-12 text-center sm:px-6 sm:py-16', className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CloudOff className="size-6" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">
          {online ? t('Couldn’t load this', '載入失敗') : t('You’re offline', '目前離線')}
        </h3>
        <p className="mx-auto max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {online
            ? t('Your data is safe — this screen just failed to fetch it.', '你的資料安好 —— 只是這個畫面沒抓到。')
            : t('Reconnect and try again — nothing was lost.', '恢復連線後再試一次,資料不會不見。')}
        </p>
      </div>
      {onRetry ? (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:border-brand/50 hover:text-brand"
        >
          <RefreshCw className="size-3.5" /> {t('Retry', '重試')}
        </button>
      ) : null}
    </div>
  )
}
