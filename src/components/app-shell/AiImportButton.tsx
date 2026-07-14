import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShell } from '@/lib/mobile-nav'
import { useT } from '@/lib/i18n'

/**
 * Mobile "Import from AI" affordance: a brand pill dropped into a Space's
 * PageHeader `actions`. Hidden at `lg+`, where the always-visible sidebar
 * button (AppSidebar) carries it instead — so desktop shows it once, in the
 * chrome, and phones show it in-header. Opens the Space-aware import dialog
 * (reads the route to pick the right flow). Label collapses to the icon below `sm`.
 */
export function AiImportButton() {
  const t = useT()
  const { openImport } = useShell()
  return (
    <Button
      variant="brand-soft"
      size="sm"
      onClick={openImport}
      data-tour="import"
      aria-label={t('Import with AI', '用 AI 匯入')}
      title={t('Import with AI', '用 AI 匯入')}
      className="lg:hidden"
    >
      <Sparkles className="size-4" />
      <span className="hidden sm:inline">{t('Import with AI', '用 AI 匯入')}</span>
    </Button>
  )
}
