import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useCreateTransaction, useUpdateTransaction } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { LedgerDetail } from '@/lib/api'
import type { TransactionRow } from '@/lib/database.types'
import { todayISO } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type TxnType = 'expense' | 'income' | 'transfer'

export function TransactionDialog({
  open,
  onOpenChange,
  ledger,
  transaction,
  defaultAccountId,
  isSplit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ledger: LedgerDetail
  transaction?: TransactionRow
  defaultAccountId?: string
  isSplit?: boolean
}) {
  const t = useT()
  const editing = Boolean(transaction)
  // A split expense's amount/type/account are owned by its per-member splits;
  // editing them here would desync the splits, so lock them and steer to Split.
  const locked = editing && !!isSplit
  const createTxn = useCreateTransaction()
  const updateTxn = useUpdateTransaction()
  const accounts = ledger.accounts.filter((a) => !a.is_archived)

  const [type, setType] = useState<TxnType>('expense')
  const [amount, setAmount] = useState('')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [payee, setPayee] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayISO())

  useEffect(() => {
    if (!open) return
    setType(((transaction?.type as TxnType) ?? 'expense') as TxnType)
    setAmount(transaction ? String(transaction.amount) : '')
    setAccountId(transaction?.account_id ?? defaultAccountId ?? accounts[0]?.id ?? '')
    setToAccountId(transaction?.transfer_account_id ?? '')
    setCategoryId(transaction?.category_id ?? '')
    setPayee(transaction?.payee ?? '')
    setNote(transaction?.note ?? '')
    setDate(transaction?.txn_date ?? todayISO())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, transaction, defaultAccountId])

  const cats = ledger.categories.filter((c) => c.kind === (type === 'income' ? 'income' : 'expense'))
  const pending = createTxn.isPending || updateTxn.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      toast.error(t('Enter an amount', '請輸入金額'))
      return
    }
    if (type === 'transfer' && (!accountId || !toAccountId || accountId === toAccountId)) {
      toast.error(t('Pick two different accounts', '請選兩個不同的帳戶'))
      return
    }
    try {
      if (editing && transaction && locked) {
        // Split expense: only the non-amount metadata is safe to edit here.
        await updateTxn.mutateAsync({
          transaction_id: transaction.id,
          category_id: categoryId || undefined,
          payee: payee || undefined,
          note: note || undefined,
          txn_date: date,
        })
      } else if (editing && transaction) {
        await updateTxn.mutateAsync({
          transaction_id: transaction.id,
          type,
          amount: amt,
          account_id: accountId || undefined,
          category_id: type === 'transfer' ? undefined : categoryId || undefined,
          transfer_account_id: type === 'transfer' ? toAccountId || undefined : undefined,
          payee: payee || undefined,
          note: note || undefined,
          txn_date: date,
        })
      } else {
        await createTxn.mutateAsync({
          ledger_id: ledger.id,
          type,
          amount: amt,
          account_id: accountId || undefined,
          category_id: type === 'transfer' ? undefined : categoryId || undefined,
          transfer_account_id: type === 'transfer' ? toAccountId || undefined : undefined,
          payee: payee || undefined,
          note: note || undefined,
          txn_date: date,
        })
      }
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save', '儲存失敗'))
    }
  }

  const TYPE_TABS: { v: TxnType; en: string; zh: string }[] = [
    { v: 'expense', en: 'Expense', zh: '支出' },
    { v: 'income', en: 'Income', zh: '收入' },
    { v: 'transfer', en: 'Transfer', zh: '轉帳' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? t('Edit transaction', '編輯交易') : t('New transaction', '新增交易')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          {locked ? (
            <div className="rounded-lg border border-brand/30 bg-brand/5 p-2.5 text-[12px] leading-relaxed text-muted-foreground">
              {t(
                'This is a split expense — its amount is set by the per-person split. Edit shares from the Split tab; here you can still change category, payee, date, and note.',
                '這是分帳交易,金額由各人分攤決定。請到「分帳」頁編輯分攤;此處仍可改分類、對象、日期與備註。',
              )}
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted/60 p-1">
            {TYPE_TABS.map((tt) => (
              <button
                type="button"
                key={tt.v}
                disabled={locked}
                onClick={() => setType(tt.v)}
                className={`rounded-md py-1.5 text-[13px] font-medium transition disabled:opacity-50 ${
                  type === tt.v ? 'bg-brand text-brand-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(tt.en, tt.zh)}
              </button>
            ))}
          </div>

          <div className="flex items-baseline gap-2 border-b border-border pb-2">
            <span className="text-lg text-muted-foreground">{ledger.base_currency}</span>
            <input
              id="txn-amount"
              autoFocus={!locked}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              readOnly={locked}
              placeholder="0"
              className={`w-full bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40 ${locked ? 'opacity-50' : ''}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="txn-account">{type === 'transfer' ? t('From', '從') : t('Account', '帳戶')}</Label>
              <Select id="txn-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={locked}>
                <option value="">{t('—', '—')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon ? `${a.icon} ` : ''}
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            {type === 'transfer' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="txn-to">{t('To', '到')}</Label>
                <Select id="txn-to" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  <option value="">{t('—', '—')}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon ? `${a.icon} ` : ''}
                      {a.name}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="txn-cat">{t('Category', '分類')}</Label>
                <Select id="txn-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  <option value="">{t('Uncategorised', '未分類')}</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon ? `${c.icon} ` : ''}
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="txn-date">{t('Date', '日期')}</Label>
              <Input id="txn-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="txn-payee">{t('Payee', '對象/店家')}</Label>
              <Input id="txn-payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={t('optional', '選填')} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="txn-note">{t('Note', '備註')}</Label>
            <Textarea id="txn-note" value={note} onChange={(e) => setNote(e.target.value)} />
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
