import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

/**
 * The one shared "written by your AI" pill (audit QW10) — pure surfacing of
 * `created_via === 'mcp'` / `source === 'mcp'`; the app never generates content
 * itself. `isNew` adds a dot for rows that appeared since your last visit.
 */
export function AiChip({ isNew = false, className }: { isNew?: boolean; className?: string }) {
  const t = useT()
  const label = isNew
    ? t('Added by your AI since your last visit', '你的 AI 在你上次來之後新增的')
    : t('Added by your AI', '由你的 AI 新增')
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-muted px-1.5 py-px text-[10px] font-medium text-brand',
        className,
      )}
      title={label}
    >
      <Sparkles className="size-3" aria-hidden />
      {/* Visible chip says "AI"; the full provenance (incl. the new-since state
          the dot conveys by colour) is in the DOM for screen readers. */}
      <span aria-hidden>AI</span>
      <span className="sr-only">{label}</span>
      {isNew ? <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-brand" aria-hidden /> : null}
    </span>
  )
}

/**
 * "New since last visit" cutoff for a screen (QW10): returns a predicate for
 * created_at timestamps, and stamps the visit so the dots clear next time.
 */
export function useNewSince(screenKey: string): (createdAt: string | null | undefined) => boolean {
  const [since] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`mnema:seen:${screenKey}`)
    } catch {
      return null
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(`mnema:seen:${screenKey}`, new Date().toISOString())
    } catch {
      /* private mode */
    }
  }, [screenKey])
  return (createdAt) => Boolean(since && createdAt && createdAt > since)
}
