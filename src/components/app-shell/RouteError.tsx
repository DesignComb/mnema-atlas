import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useT } from '@/lib/i18n'

/**
 * Router-level error boundary (audit A5): an unexpected record shape or render
 * crash gets a calm recovery card instead of an unrecoverable white screen.
 */
export function RouteErrorScreen({ error }: { error: unknown }) {
  const t = useT()
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-base font-semibold">{t('Something went wrong', '出了點問題')}</h1>
        <p className="mx-auto max-w-sm text-[13.5px] leading-relaxed text-muted-foreground">
          {t('Your data is safe. Reloading usually fixes this.', '你的資料安好。重新整理通常就能恢復。')}
        </p>
        {message ? (
          <p className="mx-auto max-w-md break-words font-mono text-[11px] text-muted-foreground/70">{message}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-[13px] font-medium text-brand-foreground transition hover:opacity-90"
        >
          <RefreshCw className="size-3.5" /> {t('Reload', '重新整理')}
        </button>
        <a href="/today" className="text-[13px] font-medium text-muted-foreground transition hover:text-foreground">
          {t('Go home', '回首頁')}
        </a>
      </div>
    </div>
  )
}
