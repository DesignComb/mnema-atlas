import { useState } from 'react'
import { Check, Copy, Link2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateShareLink, useRevokeShareLink, useShareLinks } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/** Build the public share URL, honouring the Vite base path. */
export function shareUrl(token: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  return `${window.location.origin}${base}/s/${token}`
}

export function ShareDialog({
  open,
  onOpenChange,
  itineraryId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  itineraryId: string
}) {
  const t = useT()
  const { data: links } = useShareLinks(itineraryId)
  const createLink = useCreateShareLink()
  const revokeLink = useRevokeShareLink()
  const [hideCosts, setHideCosts] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  const active = (links ?? []).filter((l) => !l.revoked_at)

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(shareUrl(token))
      setCopied(token)
      setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500)
      toast.success(t('Link copied', '已複製連結'))
    } catch {
      toast.error(t('Could not copy', '無法複製'))
    }
  }

  async function create() {
    try {
      const link = await createLink.mutateAsync({ itineraryId, hideCosts })
      await copy(link.token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to create link', '建立連結失敗'))
    }
  }

  async function revoke(id: string) {
    try {
      await revokeLink.mutateAsync({ id, itineraryId })
      toast.success(t('Link revoked', '已撤銷連結'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to revoke link', '撤銷連結失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Share trip', '分享行程')}</DialogTitle>
          <DialogDescription>
            {t(
              'Anyone with a link can view this trip (read-only). Revoke a link any time.',
              '任何人只要有連結就能檢視這個行程（唯讀）。你隨時可以撤銷連結。',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {active.length ? (
            <div className="space-y-1.5">
              {active.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[12px] text-muted-foreground">{shareUrl(l.token)}</p>
                    {l.hide_costs ? (
                      <p className="text-[11px] text-muted-foreground/80">{t('Costs hidden', '隱藏花費')}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(l.token)}
                    title={t('Copy', '複製')}
                    className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground"
                  >
                    {copied === l.token ? <Check className="size-4 text-brand" /> : <Copy className="size-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke(l.id)}
                    title={t('Revoke', '撤銷')}
                    className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[13px] text-muted-foreground">
              {t('No share links yet.', '還沒有分享連結。')}
            </p>
          )}

          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={hideCosts}
              onChange={(e) => setHideCosts(e.target.checked)}
              className="size-4 rounded border-input accent-brand"
            />
            {t('Hide costs in the shared view', '在分享頁面隱藏花費')}
          </label>

          <Button variant="brand" onClick={create} disabled={createLink.isPending}>
            <Link2 className="size-4" />
            {createLink.isPending ? t('Creating…', '建立中…') : t('Create share link', '建立分享連結')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
