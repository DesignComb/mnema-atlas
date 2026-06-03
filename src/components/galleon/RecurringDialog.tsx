import { useState } from 'react'
import { Plus, Repeat, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteRecurringTransaction, useRecurring, useSetRecurringTransaction } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { LedgerDetail } from '@/lib/api'
import { buildRRule, shortRecurrenceLabel, type Freq } from '@/lib/recurrence'
import { fmtMoney, todayISO } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function RecurringDialog({ open, onOpenChange, ledger }: { open: boolean; onOpenChange: (v: boolean) => void; ledger: LedgerDetail }) {
  const t = useT()
  const { data: rows } = useRecurring(ledger.id)
  const setRec = useSetRecurringTransaction()
  const delRec = useDeleteRecurringTransaction()
  const accounts = ledger.accounts.filter((a) => !a.is_archived)

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [freq, setFreq] = useState<Freq>('MONTHLY')
  const [nextRun, setNextRun] = useState(todayISO())
  const [payee, setPayee] = useState('')

  const cats = ledger.categories.filter((c) => c.kind === type)

  async function add() {
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      toast.error(t('Enter an amount', '請輸入金額'))
      return
    }
    try {
      await setRec.mutateAsync({
        ledger_id: ledger.id,
        type,
        amount: amt,
        recurrence_rule: buildRRule(freq, 1, []),
        next_run: nextRun,
        account_id: accountId || undefined,
        category_id: categoryId || undefined,
        payee: payee || undefined,
      })
      setAmount('')
      setPayee('')
      toast.success(t('Recurring added', '已加入定期'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('Failed', '失敗'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Recurring transactions', '定期收支')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {(rows ?? []).map((r) => {
            const cat = ledger.categories.find((c) => c.id === r.category_id)
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                <Repeat className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">
                    {cat?.icon ? `${cat.icon} ` : ''}
                    {r.payee || cat?.name || (r.type === 'income' ? t('Income', '收入') : t('Expense', '支出'))}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {shortRecurrenceLabel(r.recurrence_rule, t)} · {t('next', '下次')} {r.next_run}
                  </p>
                </div>
                <span className={`text-[13px] font-medium tabular-nums ${r.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                  {fmtMoney(r.amount, r.currency)}
                </span>
                <button onClick={() => delRec.mutate(r.id)} className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-destructive" aria-label={t('Delete', '刪除')}>
                  <Trash2 className="size-4" />
                </button>
              </div>
            )
          })}
          {!(rows ?? []).length ? (
            <p className="px-1 py-2 text-[12.5px] text-muted-foreground/70">{t('No recurring transactions yet.', '還沒有定期收支。')}</p>
          ) : null}
        </div>

        <div className="mt-2 space-y-3 rounded-xl border border-dashed border-border p-3">
          <p className="text-[12px] font-semibold text-muted-foreground">{t('Add recurring', '新增定期')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Select value={type} onChange={(e) => setType(e.target.value as 'expense' | 'income')}>
              <option value="expense">{t('Expense', '支出')}</option>
              <option value="income">{t('Income', '收入')}</option>
            </Select>
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('Amount', '金額')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{t('Account', '帳戶')}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">{t('Category', '分類')}</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ''}
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">{t('Repeat', '重複')}</Label>
              <Select value={freq} onChange={(e) => setFreq(e.target.value as Freq)}>
                <option value="DAILY">{t('Daily', '每天')}</option>
                <option value="WEEKLY">{t('Weekly', '每週')}</option>
                <option value="MONTHLY">{t('Monthly', '每月')}</option>
                <option value="YEARLY">{t('Yearly', '每年')}</option>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px]">{t('Next run', '下次')}</Label>
              <Input type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} />
            </div>
          </div>
          <Input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={t('Payee (optional)', '對象(選填)')} />
          <Button type="button" variant="brand" size="sm" className="w-full" onClick={() => void add()} disabled={setRec.isPending}>
            <Plus className="size-4" /> {t('Add', '新增')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
