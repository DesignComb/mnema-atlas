import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useCreateSplitExpense } from '@/lib/hooks'
import { useT } from '@/lib/i18n'
import type { LedgerDetail, MemberBalanceItem } from '@/lib/api'
import { currencyDecimals, fmtMoney, todayISO } from '@/lib/money'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Method = 'equally' | 'exact' | 'shares'

/** Distribute `amount` into `n` parts that sum exactly to it, in the currency's
 *  smallest unit (TWD/JPY = whole, others = cents), spreading any leftover unit
 *  one-by-one across the first parts (Splitwise does this too). */
function splitEqually(amount: number, n: number, decimals: number): number[] {
  if (n <= 0) return []
  const f = Math.pow(10, decimals)
  const units = Math.round(amount * f)
  const base = Math.floor(units / n)
  const extra = units - base * n
  return Array.from({ length: n }, (_, i) => (base + (i < extra ? 1 : 0)) / f)
}

export function SplitExpenseDialog({
  open,
  onOpenChange,
  ledger,
  members,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  ledger: LedgerDetail
  members: MemberBalanceItem[]
}) {
  const t = useT()
  const create = useCreateSplitExpense()
  const accounts = ledger.accounts.filter((a) => !a.is_archived)
  const cats = ledger.categories.filter((c) => c.kind === 'expense')

  const [amount, setAmount] = useState('')
  const [payee, setPayee] = useState('')
  const [date, setDate] = useState(todayISO())
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [paidBy, setPaidBy] = useState('')
  const [method, setMethod] = useState<Method>('equally')
  const [included, setIncluded] = useState<Record<string, boolean>>({})
  const [exact, setExact] = useState<Record<string, string>>({})
  const [shares, setShares] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    setAmount('')
    setPayee('')
    setDate(todayISO())
    setAccountId('')
    setCategoryId('')
    setMethod('equally')
    setPaidBy(members[0]?.member_id ?? '')
    setIncluded(Object.fromEntries(members.map((m) => [m.member_id, true])))
    setExact({})
    setShares(Object.fromEntries(members.map((m) => [m.member_id, '1'])))
  }, [open, members])

  const total = Number(amount) || 0
  const includedIds = members.filter((m) => included[m.member_id]).map((m) => m.member_id)

  const cur = ledger.base_currency
  const dec = currencyDecimals(cur)
  const f = Math.pow(10, dec)
  const roundCur = (v: number) => Math.round(v * f) / f

  // Resolve each member's owed share from the chosen method.
  const owedById = useMemo(() => {
    const map: Record<string, number> = {}
    if (method === 'equally') {
      const parts = splitEqually(total, includedIds.length, dec)
      includedIds.forEach((id, i) => (map[id] = parts[i] ?? 0))
    } else if (method === 'exact') {
      for (const id of includedIds) map[id] = Number(exact[id]) || 0
    } else {
      const weights = includedIds.map((id) => Math.max(0, Number(shares[id]) || 0))
      const totalShares = weights.reduce((s, w) => s + w, 0)
      if (totalShares > 0) {
        // distribute by share, then fix rounding drift onto the last share
        let acc = 0
        includedIds.forEach((id, i) => {
          const v = i === includedIds.length - 1 ? roundCur(total - acc) : roundCur((total * weights[i]) / totalShares)
          map[id] = v
          acc += v
        })
      }
    }
    return map
  }, [method, total, includedIds, exact, shares, dec])

  const owedSum = roundCur(includedIds.reduce((s, id) => s + (owedById[id] || 0), 0))
  const remaining = roundCur(total - owedSum)
  const balanced = total > 0 && Math.abs(remaining) < 0.5 / f && includedIds.length > 0

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (total <= 0) {
      toast.error(t('Enter an amount', '請輸入金額'))
      return
    }
    if (!paidBy) {
      toast.error(t('Pick who paid', '請選擇付款人'))
      return
    }
    if (!balanced) {
      toast.error(t('Shares must add up to the total', '分攤金額需等於總額'))
      return
    }
    const splits = members
      .map((m) => ({
        member_id: m.member_id,
        paid: m.member_id === paidBy ? total : 0,
        owed: owedById[m.member_id] || 0,
      }))
      .filter((s) => s.paid > 0 || s.owed > 0)
    try {
      await create.mutateAsync({
        ledger_id: ledger.id,
        amount: total,
        splits,
        account_id: accountId || undefined,
        category_id: categoryId || undefined,
        payee: payee || undefined,
        txn_date: date,
      })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('Failed to save', '儲存失敗'))
    }
  }

  const METHODS: { v: Method; en: string; zh: string }[] = [
    { v: 'equally', en: 'Equally', zh: '平均' },
    { v: 'exact', en: 'Exact', zh: '指定金額' },
    { v: 'shares', en: 'Shares', zh: '比例' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('Split an expense', '分帳')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex items-baseline gap-2 border-b border-border pb-2">
            <span className="text-lg text-muted-foreground">{cur}</span>
            <input
              autoFocus
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-2xl font-semibold tabular-nums outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-payee">{t('What for', '項目')}</Label>
              <Input id="sp-payee" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder={t('e.g. Dinner', '例如:晚餐')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-date">{t('Date', '日期')}</Label>
              <Input id="sp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-paid">{t('Paid by', '付款人')}</Label>
              <Select id="sp-paid" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
                {members.map((m) => (
                  <option key={m.member_id} value={m.member_id}>
                    {m.display_name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-cat">{t('Category', '分類')}</Label>
              <Select id="sp-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">{t('Uncategorised', '未分類')}</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ''}
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {accounts.length ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sp-acc">{t('Account (optional)', '帳戶(選填)')}</Label>
              <Select id="sp-acc" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">{t('— none —', '— 無 —')}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.icon ? `${a.icon} ` : ''}
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-muted/60 p-1">
              {METHODS.map((m) => (
                <button
                  type="button"
                  key={m.v}
                  onClick={() => setMethod(m.v)}
                  className={`rounded-md py-1.5 text-[13px] font-medium transition ${
                    method === m.v ? 'bg-brand text-brand-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t(m.en, m.zh)}
                </button>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              {members.map((m) => {
                const on = !!included[m.member_id]
                const owed = owedById[m.member_id] || 0
                return (
                  <div key={m.member_id} className="flex items-center gap-2.5 border-b border-border/60 px-3 py-2 last:border-b-0">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => setIncluded((s) => ({ ...s, [m.member_id]: e.target.checked }))}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className={`flex-1 truncate text-[14px] ${on ? '' : 'text-muted-foreground/50'}`}>{m.display_name}</span>
                    {on && method === 'exact' ? (
                      <input
                        inputMode="decimal"
                        value={exact[m.member_id] ?? ''}
                        onChange={(e) => setExact((s) => ({ ...s, [m.member_id]: e.target.value }))}
                        placeholder="0"
                        className="w-24 rounded border border-input bg-card px-2 py-1 text-right text-[13px] tabular-nums outline-none focus:border-brand"
                      />
                    ) : on && method === 'shares' ? (
                      <div className="flex items-center gap-2">
                        <input
                          inputMode="numeric"
                          value={shares[m.member_id] ?? ''}
                          onChange={(e) => setShares((s) => ({ ...s, [m.member_id]: e.target.value }))}
                          placeholder="1"
                          className="w-14 rounded border border-input bg-card px-2 py-1 text-right text-[13px] tabular-nums outline-none focus:border-brand"
                        />
                        <span className="w-20 text-right text-[12.5px] tabular-nums text-muted-foreground">{fmtMoney(owed, cur)}</span>
                      </div>
                    ) : (
                      <span className="text-[13px] tabular-nums text-muted-foreground">{on ? fmtMoney(owed, cur) : '—'}</span>
                    )}
                  </div>
                )
              })}
            </div>

            <div className={`flex items-center justify-between px-1 text-[12px] ${balanced ? 'text-muted-foreground' : 'text-red-500'}`}>
              <span>
                {t('Split', '已分')} {fmtMoney(owedSum, cur)} / {fmtMoney(total, cur)}
              </span>
              <span className="tabular-nums">
                {balanced ? t('✓ balanced', '✓ 剛好') : `${t('remaining', '剩餘')} ${fmtMoney(remaining, cur)}`}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('Cancel', '取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={create.isPending || !balanced}>
              {create.isPending ? t('Saving…', '儲存中…') : t('Add split', '新增分帳')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
