import { humanizeError } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSetSubscription } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { LedgerDetail } from '@/lib/api'
import type { SubscriptionRow } from '@/lib/database.types'
import { buildRRule, parseRRule, type Freq } from '@/lib/recurrence'
import { todayISO } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function SubscriptionDialog({
  open,
  onOpenChange,
  ledger,
  subscription,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ledger: LedgerDetail
  subscription?: SubscriptionRow
}) {
  const t = useT()
  const save = useSetSubscription()
  const editing = Boolean(subscription)
  const accounts = ledger.accounts.filter((a) => !a.is_archived)
  const cats = ledger.categories.filter((c) => c.kind === 'expense')

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [freq, setFreq] = useState<Freq>('MONTHLY')
  const [renewal, setRenewal] = useState(todayISO())
  const [reminderDays, setReminderDays] = useState('7')
  const [notes, setNotes] = useState('')
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(subscription?.name ?? '')
    setAmount(subscription?.amount != null ? String(subscription.amount) : '')
    setAccountId(subscription?.account_id ?? '')
    setCategoryId(subscription?.category_id ?? '')
    setFreq(subscription ? parseRRule(subscription.recurrence_rule).freq === 'none' ? 'MONTHLY' : parseRRule(subscription.recurrence_rule).freq as Freq : 'MONTHLY')
    setRenewal(subscription?.renewal_date ?? todayISO())
    setReminderDays(subscription?.cancel_reminder_days != null ? String(subscription.cancel_reminder_days) : '7')
    setNotes(subscription?.notes ?? '')
    setActive(subscription?.is_active ?? true)
  }, [open, subscription])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!name.trim()) {
      toast.error(t('Name is required', '請輸入名稱'))
      return
    }
    if (!amt || amt <= 0) {
      toast.error(t('Enter an amount', '請輸入金額'))
      return
    }
    try {
      await save.mutateAsync({
        ledger_id: ledger.id,
        subscription_id: subscription?.id,
        name: name.trim(),
        amount: amt,
        renewal_date: renewal,
        recurrence_rule: buildRRule(freq, 1, []),
        account_id: accountId || undefined,
        category_id: categoryId || undefined,
        cancel_reminder_days: reminderDays.trim() ? Number(reminderDays) : undefined,
        notes: notes.trim() || undefined,
        is_active: active,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(humanizeError(err, ['Failed to save', '儲存失敗']))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit subscription', '編輯訂閱') : t('New subscription', '新增訂閱')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sub-name">{t('Name', '名稱')}</Label>
            <Input id="sub-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Netflix', '例如:Netflix')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-amount">{t('Amount', '金額')}</Label>
              <Input id="sub-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-renewal">{t('Next renewal', '下次續訂')}</Label>
              <Input id="sub-renewal" type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-account">{t('Account', '帳戶')}</Label>
              <Select id="sub-account" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">{t('— none —', '— 無 —')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-cat">{t('Category', '分類')}</Label>
              <Select id="sub-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{t('— none —', '— 無 —')}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon ? `${c.icon} ` : ''}{c.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-freq">{t('Billing cycle', '計費週期')}</Label>
              <Select id="sub-freq" value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
                <option value="WEEKLY">{t('Weekly', '每週')}</option>
                <option value="MONTHLY">{t('Monthly', '每月')}</option>
                <option value="YEARLY">{t('Yearly', '每年')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sub-remind">{t('Remind days before', '提前幾天提醒')}</Label>
              <Input id="sub-remind" inputMode="numeric" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} placeholder="7" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sub-notes">{t('Notes', '備註')}</Label>
            <Textarea id="sub-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-[13px] text-foreground">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-4 accent-[var(--brand)]" />
            {t('Active (auto-post expenses)', '啟用(自動入帳)')}
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={save.isPending}>
              {save.isPending ? t('Saving…', '儲存中…') : editing ? t('Save', '儲存') : t('Add', '新增')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
