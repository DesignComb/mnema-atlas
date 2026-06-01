import { useState } from 'react'
import { UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAddMember, useMembers, useRemoveMember } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const selectClass =
  'h-9 rounded-md border border-input bg-card px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40'

export function MembersDialog({
  open,
  onOpenChange,
  itineraryId,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  itineraryId: string
}) {
  const t = useT()
  const { data: members } = useMembers(itineraryId, open)
  const addMember = useAddMember()
  const removeMember = useRemoveMember()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'viewer' | 'editor'>('editor')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const v = email.trim()
    if (!v) return
    try {
      await addMember.mutateAsync({ itineraryId, email: v, role })
      setEmail('')
      toast.success(t('Collaborator added', '已加入協作者'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to add collaborator', '加入協作者失敗'))
    }
  }

  async function remove(userId: string) {
    try {
      await removeMember.mutateAsync({ itineraryId, memberUserId: userId })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to remove', '移除失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Collaborators', '協作者')}</DialogTitle>
          <DialogDescription>
            {t(
              'Invite people by the email they sign in with. Editors can change the trip; viewers can only look.',
              '用對方登入的電子郵件邀請他們。編輯者可修改行程，檢視者只能查看。',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <form onSubmit={add} className="flex items-center gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('email@example.com', 'email@example.com')}
              className="flex-1"
            />
            <select className={selectClass} value={role} onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}>
              <option value="editor">{t('Editor', '編輯者')}</option>
              <option value="viewer">{t('Viewer', '檢視者')}</option>
            </select>
            <Button type="submit" variant="brand" size="sm" disabled={addMember.isPending || !email.trim()}>
              <UserPlus className="size-4" />
            </Button>
          </form>

          {members?.length ? (
            <div className="space-y-1.5">
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {m.display_name || t('Member', '成員')}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.role === 'editor' ? t('Editor', '編輯者') : t('Viewer', '檢視者')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(m.user_id)}
                    title={t('Remove', '移除')}
                    className="rounded p-1.5 text-muted-foreground transition hover:bg-accent hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-[13px] text-muted-foreground">
              {t('No collaborators yet.', '還沒有協作者。')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
