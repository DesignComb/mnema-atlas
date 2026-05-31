import type { ReactNode } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobileNav } from '@/lib/mobile-nav'

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
