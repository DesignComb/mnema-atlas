import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateLedger, useUpdateLedger } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { LedgerRow } from '@/lib/database.types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function LedgerDialog({
  open,
  onOpenChange,
  ledger,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ledger?: LedgerRow
  onCreated?: (id: string) => void
}) {
  const t = useT()
  const editing = Boolean(ledger)
  const createLedger = useCreateLedger()
  const updateLedger = useUpdateLedger()
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('TWD')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (!open) return
    setName(ledger?.name ?? '')
    setCurrency(ledger?.base_currency ?? 'TWD')
    setIcon(ledger?.icon ?? '')
  }, [open, ledger])

  const pending = createLedger.isPending || updateLedger.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editing && ledger) {
        await updateLedger.mutateAsync({ ledger_id: ledger.id, name: name.trim(), base_currency: currency, icon: icon.trim() || undefined })
      } else {
        const l = await createLedger.mutateAsync({ name: name.trim(), base_currency: currency, icon: icon.trim() || undefined })
        onCreated?.(l.id)
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save ledger', '儲存帳本失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit ledger', '編輯帳本') : t('New ledger', '新增帳本')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-end gap-2">
            <div className="flex w-16 flex-col gap-1.5">
              <Label htmlFor="ledger-icon">{t('Icon', '圖示')}</Label>
              <Input id="ledger-icon" value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 2))} placeholder="💰" className="text-center" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="ledger-name">{t('Name', '名稱')}</Label>
              <Input id="ledger-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Daily, Household', '例如:日常、家庭')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ledger-cur">{t('Base currency', '主要幣別')}</Label>
            <Input id="ledger-cur" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 5))} placeholder="TWD" />
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
