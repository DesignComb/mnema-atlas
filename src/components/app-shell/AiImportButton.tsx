import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useShell } from '@/lib/mobile-nav'
import { useT } from '@/lib/i18n'

/**
 * Header affordance that opens the Space-aware "Import from AI" dialog. The
 * dialog itself reads the current route to pick the right Space's prompt, so
 * this button is identical everywhere — drop it into any Space's PageHeader
 * `actions`. Label collapses to just the icon below `sm`.
 */
export function AiImportButton() {
  const t = useT()
  const { openImport } = useShell()
  return (
    <Button variant="ghost" size="sm" onClick={openImport} title={t('Import with AI', '用 AI 匯入')}>
      <Sparkles className="size-4" />
      <span className="hidden sm:inline">{t('Import with AI', '用 AI 匯入')}</span>
    </Button>
  )
}
