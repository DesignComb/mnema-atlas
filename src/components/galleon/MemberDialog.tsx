import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAddLedgerMember, useUpdateLedgerMember } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { MemberBalanceItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/** Add a name-only guest, invite a real Mnema user by email, or edit an existing member. */
export function MemberDialog({
  open,
  onOpenChange,
  ledgerId,
  member,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ledgerId: string
  member?: MemberBalanceItem
}) {
  const t = useT()
  const editing = Boolean(member)
  const add = useAddLedgerMember()
  const update = useUpdateLedgerMember()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')

  useEffect(() => {
    if (!open) return
    setName(member?.display_name ?? '')
    setEmail('')
    setRole((member?.role === 'viewer' ? 'viewer' : 'editor') as 'editor' | 'viewer')
  }, [open, member])

  const pending = add.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('Enter a name', '請輸入名稱'))
      return
    }
    try {
      if (editing && member) {
        await update.mutateAsync({ member_id: member.member_id, display_name: name.trim(), role })
      } else {
        await add.mutateAsync({ ledger_id: ledgerId, display_name: name.trim(), email: email.trim() || undefined, role })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit person', '編輯成員') : t('Add person', '新增成員')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mem-name">{t('Name', '名稱')}</Label>
            <Input id="mem-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Roommate', '例如:室友')} />
          </div>

          {!editing ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mem-email">{t('Invite by email', '用 Email 邀請')}</Label>
              <Input
                id="mem-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('optional — existing Mnema user', '選填 —— 已是 Mnema 使用者')}
              />
              <p className="text-[11px] text-muted-foreground/80">
                {t(
                  'A registered Mnema user joins as a real collaborator (can open this ledger with their own AI). Any other email — or none — just adds a name-only guest.',
                  '已註冊的 Mnema 使用者會成為真正的協作者(能用自己的 AI 開這本帳本)。其他 Email(或留空)則只是加為掛名成員。',
                )}
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mem-role">{t('Role', '角色')}</Label>
            <Select id="mem-role" value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}>
              <option value="editor">{t('Editor — can add & edit', '編輯者 —— 可新增與編輯')}</option>
              <option value="viewer">{t('Viewer — read only', '檢視者 —— 唯讀')}</option>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add', '新增')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
