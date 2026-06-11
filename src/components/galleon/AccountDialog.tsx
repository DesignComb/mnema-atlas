import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateAccount, useUpdateAccount } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import { ACCOUNT_TYPE_LABEL } from '@/lib/money'
import type { LedgerAccount } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const TYPES = ['cash', 'bank', 'credit', 'ewallet', 'investment'] as const

export function AccountDialog({
  open,
  onOpenChange,
  ledgerId,
  baseCurrency,
  account,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ledgerId: string
  baseCurrency: string
  account?: LedgerAccount
}) {
  const t = useT()
  const editing = Boolean(account)
  const createAccount = useCreateAccount()
  const updateAccount = useUpdateAccount()
  const [name, setName] = useState('')
  const [type, setType] = useState<(typeof TYPES)[number]>('cash')
  const [currency, setCurrency] = useState(baseCurrency)
  const [opening, setOpening] = useState('0')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (!open) return
    setName(account?.name ?? '')
    setType(((account?.type as (typeof TYPES)[number]) ?? 'cash') as (typeof TYPES)[number])
    setCurrency(account?.currency ?? baseCurrency)
    setOpening(account ? String(account.opening_balance) : '0')
    setIcon(account?.icon ?? '')
  }, [open, account, baseCurrency])

  const pending = createAccount.isPending || updateAccount.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const opening_balance = Number(opening) || 0
    try {
      if (editing && account) {
        await updateAccount.mutateAsync({ account_id: account.id, name: name.trim(), type, currency, opening_balance, icon: icon.trim() || undefined })
      } else {
        await createAccount.mutateAsync({ ledger_id: ledgerId, name: name.trim(), type, currency, opening_balance, icon: icon.trim() || undefined })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save account', '儲存帳戶失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit account', '編輯帳戶') : t('New account', '新增帳戶')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex w-16 flex-col gap-1.5">
              <Label htmlFor="acc-icon">{t('Icon', '圖示')}</Label>
              <Input id="acc-icon" value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2))} placeholder="👛" className="text-center" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="acc-name">{t('Name', '名稱')}</Label>
              <Input id="acc-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Wallet, Bank', '例如:錢包、銀行')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-type">{t('Type', '類型')}</Label>
              <Select id="acc-type" value={type} onChange={(e) => setType(e.target.value as (typeof TYPES)[number])}>
                {TYPES.map((ty) => (
                  <option key={ty} value={ty}>
                    {t(...ACCOUNT_TYPE_LABEL[ty])}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc-cur">{t('Currency', '幣別')}</Label>
              <Input id="acc-cur" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 5))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="acc-open">{t('Opening balance', '初始餘額')}</Label>
            <Input id="acc-open" inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={pending || !name.trim()}>
              {pending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Create', '建立')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
