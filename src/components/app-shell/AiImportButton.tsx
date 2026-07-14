import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShell } from '@/lib/mobile-nav'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * The ONE "Import with AI" affordance — a single, distinctive button rendered
 * identically everywhere (the desktop sidebar + every Space's mobile header). It
 * uses the FIXED violet `--color-ai` accent, NOT the per-Space brand hue, so the
 * BYO-AI front door reads as one recognisable global action that never changes
 * colour by Space (mirrors how Capture is a fixed, non-re-hued affordance).
 *
 *  - default : a compact pill for a PageHeader `actions` slot. Hidden at `lg+`,
 *    where the sidebar carries it; the label collapses to the icon below `sm`.
 *  - `block` : full-width, for the sidebar chrome (shown at `lg+`).
 */
export function AiImportButton({ block }: { block?: boolean }) {
  const t = useT()
  const { openImport } = useShell()
  return (
    <Button
      variant="ai"
      size="sm"
      onClick={openImport}
      data-tour="import"
      aria-label={t('Import with AI', '用 AI 匯入')}
      title={t('Import with AI', '用 AI 匯入')}
      className={cn(block ? 'w-full justify-start' : 'lg:hidden')}
    >
      <Sparkles className="size-4" />
      <span className={cn(!block && 'hidden sm:inline')}>{t('Import with AI', '用 AI 匯入')}</span>
    </Button>
  )
}
