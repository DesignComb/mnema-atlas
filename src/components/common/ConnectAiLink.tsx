import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { listApiKeys } from '@/lib/api'
import { useT } from '@/lib/i18n'

/**
 * "Connect an AI →" teaching link for empty states (audit QW11). Renders only
 * while the user has no active API key — once an AI is connected it disappears,
 * so it never nags.
 */
export function ConnectAiLink() {
  const t = useT()
  const { data: keys } = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys, staleTime: 5 * 60_000 })
  if (!keys || keys.some((k) => !k.revoked_at)) return null
  return (
    <Link
      to="/settings/integrations"
      className="inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline"
    >
      <Sparkles className="size-3.5" /> {t('Connect an AI →', '連接 AI →')}
    </Link>
  )
}
