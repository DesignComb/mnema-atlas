import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Coins,
  HandCoins,
  MoreHorizontal,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Undo2,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import {
  useBalances,
  useBudgetStatus,
  useDeleteAccount,
  useDeleteBudget,
  useDeleteLedger,
  useDeleteSettlement,
  useDeleteTransaction,
  useLedger,
  useLedgers,
  useLedgerSummary,
  useLedgerTransactions,
  useMonthlyTrend,
  useRecordSettlement,
  useRemoveLedgerMember,
  useRunDueRecurring,
  useSetBudget,
  useSettlements,
} from '@/lib/hooks'
import { useI18n, useT } from '@/lib/i18n'
import type { BudgetStatusItem, LedgerAccount, LedgerCategory, LedgerDetail, MemberBalanceItem } from '@/lib/api'
import type { TransactionRow } from '@/lib/database.types'
import { settleUp } from '@shared/settle'
import { ACCOUNT_TYPE_LABEL, addMonths, fmtLedgerDate, fmtMoney, monthRange } from '@/lib/money'
import { PageHeader, EmptyState } from '@/components/app-shell/PageHeader'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LedgerDialog } from '@/components/galleon/LedgerDialog'
import { AccountDialog } from '@/components/galleon/AccountDialog'
import { TransactionDialog } from '@/components/galleon/TransactionDialog'
import { RecurringDialog } from '@/components/galleon/RecurringDialog'
import { MemberDialog } from '@/components/galleon/MemberDialog'
import { SplitExpenseDialog } from '@/components/galleon/SplitExpenseDialog'

type View = 'overview' | 'transactions' | 'accounts' | 'budgets' | 'reports' | 'split'
const VIEWS: { k: View; en: string; zh: string }[] = [
  { k: 'overview', en: 'Overview', zh: '總覽' },
  { k: 'transactions', en: 'Transactions', zh: '交易' },
  { k: 'split', en: 'Split', zh: '分帳' },
  { k: 'accounts', en: 'Accounts', zh: '帳戶' },
  { k: 'budgets', en: 'Budgets', zh: '預算' },
  { k: 'reports', en: 'Reports', zh: '報表' },
]

export function GalleonScreen() {
  const t = useT()
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { section?: View; ledger?: string }
  const view: View = search.section ?? 'overview'

  const { data: ledgers, isLoading } = useLedgers()
  const active = (ledgers ?? []).filter((l) => !l.is_archived)
  const ledgerId = search.ledger && active.some((l) => l.id === search.ledger) ? search.ledger : active[0]?.id ?? ''

  const { data: ledger } = useLedger(ledgerId)
  const { data: balancesForDialog = [] } = useBalances(ledgerId)
  const deleteLedger = useDeleteLedger()
  const canEdit = !ledger || ledger.my_role !== 'viewer'

  const [ledgerDialog, setLedgerDialog] = useState<{ open: boolean; edit?: boolean }>({ open: false })
  const [accountDialog, setAccountDialog] = useState<{ open: boolean; account?: LedgerAccount }>({ open: false })
  const [txnDialog, setTxnDialog] = useState<{ open: boolean; txn?: TransactionRow }>({ open: false })
  const [recurringDialog, setRecurringDialog] = useState(false)
  const [memberDialog, setMemberDialog] = useState<{ open: boolean; member?: MemberBalanceItem }>({ open: false })
  const [splitDialog, setSplitDialog] = useState(false)
  const runDue = useRunDueRecurring()

  // Post any due recurring transactions when a ledger is opened (idempotent).
  useEffect(() => {
    if (ledgerId) runDue.mutate(ledgerId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledgerId])

  function setSearch(patch: Partial<{ view: View; ledger: string }>) {
    const v = patch.view ?? view
    navigate({
      to: '/galleon',
      search: { section: v === 'overview' ? undefined : v, ledger: patch.ledger ?? (ledgerId || undefined) },
      replace: true,
    })
  }

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('Money', '記帳')} icon={<Coins className="size-4" />} />
        <div className="mx-auto max-w-3xl px-4 py-6">
          <div className="h-40 animate-pulse rounded-xl bg-card" />
        </div>
      </>
    )
  }

  if (!active.length) {
    return (
      <>
        <PageHeader title={t('Money', '記帳')} icon={<Coins className="size-4" />} />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
            <EmptyState
              icon={<Coins className="size-6" />}
              title={t('Start a ledger', '建立你的第一本帳本')}
              description={t(
                'Track income, expenses and transfers across your accounts — or let your AI log them for you.',
                '記錄你各帳戶的收入、支出與轉帳 —— 或讓你的 AI 幫你記。',
              )}
              action={
                <Button variant="brand" size="sm" onClick={() => setLedgerDialog({ open: true })}>
                  <Plus className="size-4" /> {t('New ledger', '新增帳本')}
                </Button>
              }
            />
          </div>
        </div>
        <LedgerDialog
          open={ledgerDialog.open}
          onOpenChange={(o) => setLedgerDialog({ open: o })}
          onCreated={(id) => setSearch({ ledger: id })}
        />
      </>
    )
  }

  const activeLedger = active.find((l) => l.id === ledgerId)

  return (
    <>
      <PageHeader
        title={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-card">
                {activeLedger?.icon ? <span>{activeLedger.icon}</span> : <Coins className="size-4 text-brand" />}
                <span className="truncate font-semibold">{activeLedger?.name}</span>
                <ChevronsUpDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {active.map((l) => (
                <DropdownMenuItem key={l.id} onSelect={() => setSearch({ ledger: l.id })}>
                  {l.icon ? <span>{l.icon}</span> : <Coins />}
                  <span className="flex-1 truncate">{l.name}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setLedgerDialog({ open: true })}>
                <Plus /> {t('New ledger', '新增帳本')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        icon={<Coins className="size-4" />}
        actions={
          canEdit ? (
            <div className="flex items-center gap-1.5">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" aria-label={t('Ledger options', '帳本選項')}>
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setLedgerDialog({ open: true, edit: true })}>
                    <Pencil /> {t('Edit ledger', '編輯帳本')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setAccountDialog({ open: true })}>
                    <Wallet /> {t('New account', '新增帳戶')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRecurringDialog(true)}>
                    <Repeat /> {t('Recurring', '定期收支')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                    onSelect={() => void deleteLedgerFlow()}
                  >
                    <Trash2 /> {t('Delete ledger', '刪除帳本')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="brand" size="sm" onClick={() => setTxnDialog({ open: true })} disabled={!ledger}>
                <Plus className="size-4" /> <span className="hidden sm:inline">{t('Add', '記一筆')}</span>
              </Button>
            </div>
          ) : (
            <span className="rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{t('View only', '唯讀')}</span>
          )
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-4 flex items-center gap-1.5">
            {VIEWS.map((v) => (
              <button
                key={v.k}
                onClick={() => setSearch({ view: v.k })}
                className={`rounded-full px-3 py-1 text-[13px] font-medium transition ${
                  view === v.k ? 'bg-brand text-brand-foreground' : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}
              >
                {t(v.en, v.zh)}
              </button>
            ))}
          </div>

          {!ledger ? (
            <div className="h-40 animate-pulse rounded-xl bg-card" />
          ) : view === 'overview' ? (
            <Overview ledger={ledger} onEditTxn={(txn) => setTxnDialog({ open: true, txn })} onSeeAll={() => setSearch({ view: 'transactions' })} t={t} />
          ) : view === 'accounts' ? (
            <Accounts
              ledger={ledger}
              onNew={() => setAccountDialog({ open: true })}
              onEdit={(account) => setAccountDialog({ open: true, account })}
              t={t}
            />
          ) : view === 'budgets' ? (
            <Budgets ledger={ledger} t={t} />
          ) : view === 'reports' ? (
            <Reports ledger={ledger} t={t} />
          ) : view === 'split' ? (
            <Split
              ledger={ledger}
              canEdit={canEdit}
              onAddMember={() => setMemberDialog({ open: true })}
              onEditMember={(member) => setMemberDialog({ open: true, member })}
              onAddSplit={() => setSplitDialog(true)}
              t={t}
            />
          ) : (
            <Transactions ledger={ledger} onEditTxn={(txn) => setTxnDialog({ open: true, txn })} t={t} />
          )}
        </div>
      </div>

      <LedgerDialog
        open={ledgerDialog.open}
        onOpenChange={(o) => setLedgerDialog((s) => ({ ...s, open: o }))}
        ledger={ledgerDialog.edit ? activeLedger : undefined}
        onCreated={(id) => setSearch({ ledger: id })}
      />
      {ledger ? (
        <>
          <AccountDialog
            open={accountDialog.open}
            onOpenChange={(o) => setAccountDialog((s) => ({ ...s, open: o }))}
            ledgerId={ledger.id}
            baseCurrency={ledger.base_currency}
            account={accountDialog.account}
          />
          <TransactionDialog
            open={txnDialog.open}
            onOpenChange={(o) => setTxnDialog((s) => ({ ...s, open: o }))}
            ledger={ledger}
            transaction={txnDialog.txn}
          />
          <RecurringDialog open={recurringDialog} onOpenChange={setRecurringDialog} ledger={ledger} />
          <MemberDialog
            open={memberDialog.open}
            onOpenChange={(o) => setMemberDialog((s) => ({ ...s, open: o }))}
            ledgerId={ledger.id}
            member={memberDialog.member}
          />
          <SplitExpenseDialog open={splitDialog} onOpenChange={setSplitDialog} ledger={ledger} members={balancesForDialog} />
        </>
      ) : null}
    </>
  )

  async function deleteLedgerFlow() {
    if (!activeLedger) return
    if (!confirm(t(`Delete ledger “${activeLedger.name}” and everything in it?`, `刪除帳本「${activeLedger.name}」與其中所有資料?`))) return
    await deleteLedger.mutateAsync(activeLedger.id)
    setSearch({ ledger: active.find((l) => l.id !== activeLedger.id)?.id })
  }
}

function amountColor(type: string): string {
  return type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : type === 'transfer' ? 'text-muted-foreground' : 'text-foreground'
}
function amountSign(type: string): string {
  return type === 'income' ? '+' : type === 'expense' ? '−' : ''
}

type Tr = (en: string, zh: string) => string

function Overview({ ledger, onEditTxn, onSeeAll, t }: { ledger: LedgerDetail; onEditTxn: (t: TransactionRow) => void; onSeeAll: () => void; t: Tr }) {
  const [cursor, setCursor] = useState(() => new Date())
  const range = useMemo(() => monthRange(cursor), [cursor])
  const { data: summary } = useLedgerSummary(ledger.id, range.from, range.to)
  const { data: recent } = useLedgerTransactions({ ledgerId: ledger.id, from: range.from, to: range.to, limit: 8 })

  const income = Number(summary?.income ?? 0)
  const expense = Number(summary?.expense ?? 0)
  const cur = ledger.base_currency
  const accounts = ledger.accounts.filter((a) => !a.is_archived)
  const netWorth = accounts.reduce((s, a) => s + Number(a.balance), 0)
  const maxCat = Math.max(1, ...(summary?.by_category ?? []).map((c) => Number(c.total)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => setCursor(addMonths(cursor, -1))} className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-20 text-center text-[14px] font-semibold tabular-nums">{range.label}</span>
        <button onClick={() => setCursor(addMonths(cursor, 1))} className="rounded-md p-1 text-muted-foreground hover:bg-card hover:text-foreground">
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
          <p className="text-[11px] text-muted-foreground">{t('Income', '收入')}</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(income, cur)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
          <p className="text-[11px] text-muted-foreground">{t('Expense', '支出')}</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold text-red-500">{fmtMoney(expense, cur)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 shadow-soft">
          <p className="text-[11px] text-muted-foreground">{t('Net', '結餘')}</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold">{fmtMoney(income - expense, cur)}</p>
        </div>
      </div>

      {/* Net worth + accounts */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Net worth', '淨資產')}</span>
          <span className="text-[15px] font-semibold tabular-nums">{fmtMoney(netWorth, cur)}</span>
        </div>
        <div className="space-y-1">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-[13px]">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                {a.icon ? <span>{a.icon}</span> : <Wallet className="size-3.5" />} {a.name}
              </span>
              <span className="tabular-nums">{fmtMoney(a.balance, a.currency)}</span>
            </div>
          ))}
          {!accounts.length ? <p className="text-[12.5px] text-muted-foreground/70">{t('No accounts yet.', '還沒有帳戶。')}</p> : null}
        </div>
      </div>

      {/* Spending by category */}
      {(summary?.by_category ?? []).length ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Spending by category', '分類支出')}</p>
          <div className="space-y-2">
            {(summary?.by_category ?? []).slice(0, 8).map((c) => (
              <div key={c.category_id ?? 'none'}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span className="inline-flex items-center gap-1.5">
                    {c.icon ? <span>{c.icon}</span> : null} {c.name ?? t('Uncategorised', '未分類')}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{fmtMoney(c.total, cur)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(Number(c.total) / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Recent */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 sm:px-4">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Recent', '近期')}</span>
          <button onClick={onSeeAll} className="text-[12px] font-medium text-brand hover:underline">
            {t('See all', '看全部')}
          </button>
        </div>
        {(recent ?? []).length ? (
          (recent ?? []).map((tx) => <TxnRow key={tx.id} tx={tx} ledger={ledger} onEdit={() => onEditTxn(tx)} t={t} />)
        ) : (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground/70">{t('No transactions this month.', '本月還沒有交易。')}</p>
        )}
      </div>
    </div>
  )
}

function Transactions({ ledger, onEditTxn, t }: { ledger: LedgerDetail; onEditTxn: (t: TransactionRow) => void; t: Tr }) {
  const { lang } = useI18n()
  const { data: txns, isLoading } = useLedgerTransactions({ ledgerId: ledger.id, limit: 300 })
  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-card" />
  if (!(txns ?? []).length) {
    return <EmptyState icon={<Coins className="size-6" />} title={t('No transactions yet', '還沒有交易')} description={t('Tap “Add” to log one, or let your AI do it.', '點「記一筆」新增,或讓你的 AI 幫你記。')} />
  }
  // group by date
  const groups: { date: string; rows: TransactionRow[] }[] = []
  for (const tx of txns ?? []) {
    const g = groups[groups.length - 1]
    if (g && g.date === tx.txn_date) g.rows.push(tx)
    else groups.push({ date: tx.txn_date, rows: [tx] })
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.date}>
          <p className="mb-1 px-1 text-[12px] font-semibold text-muted-foreground">{fmtLedgerDate(g.date, lang)}</p>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
            {g.rows.map((tx) => (
              <TxnRow key={tx.id} tx={tx} ledger={ledger} onEdit={() => onEditTxn(tx)} t={t} withMenu />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TxnRow({ tx, ledger, onEdit, t, withMenu }: { tx: TransactionRow; ledger: LedgerDetail; onEdit: () => void; t: Tr; withMenu?: boolean }) {
  const del = useDeleteTransaction()
  const cat = ledger.categories.find((c) => c.id === tx.category_id)
  const acc = ledger.accounts.find((a) => a.id === tx.account_id)
  const toAcc = ledger.accounts.find((a) => a.id === tx.transfer_account_id)
  const label =
    tx.type === 'transfer'
      ? `${acc?.name ?? '—'} → ${toAcc?.name ?? '—'}`
      : tx.payee || cat?.name || t('Uncategorised', '未分類')

  return (
    <div className="group flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-[15px]">
          {tx.type === 'transfer' ? <ArrowLeftRight className="size-4 text-muted-foreground" /> : cat?.icon || '💸'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] text-foreground">{label}</span>
          <span className="block truncate text-[12px] text-muted-foreground">
            {acc?.name}
            {tx.note ? ` · ${tx.note}` : ''}
          </span>
        </span>
      </button>
      <span className={`shrink-0 text-[14px] font-medium tabular-nums ${amountColor(tx.type)}`}>
        {amountSign(tx.type)}
        {fmtMoney(tx.amount, tx.currency)}
      </span>
      {withMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 [@media(hover:none)]:opacity-100" aria-label={t('Options', '選項')}>
              <MoreHorizontal className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> {t('Edit', '編輯')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive [&_svg]:text-destructive" onSelect={() => del.mutate(tx.id)}>
              <Trash2 /> {t('Delete', '刪除')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

function Accounts({ ledger, onNew, onEdit, t }: { ledger: LedgerDetail; onNew: () => void; onEdit: (a: LedgerAccount) => void; t: Tr }) {
  const del = useDeleteAccount()
  const accounts = ledger.accounts
  const netWorth = accounts.filter((a) => !a.is_archived).reduce((s, a) => s + Number(a.balance), 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-soft">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Net worth', '淨資產')}</span>
        <span className="text-[16px] font-semibold tabular-nums">{fmtMoney(netWorth, ledger.base_currency)}</span>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {accounts.map((a) => (
          <div key={a.id} className={`group rounded-xl border border-border bg-card p-3.5 shadow-soft ${a.is_archived ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <button onClick={() => onEdit(a)} className="min-w-0 flex-1 text-left">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {a.icon ? <span>{a.icon}</span> : <Wallet className="size-4 text-muted-foreground" />} {a.name}
                </p>
                <p className="text-[12px] text-muted-foreground">{t(...(ACCOUNT_TYPE_LABEL[a.type] ?? ['', '']))}</p>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={t('Options', '選項')}>
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => onEdit(a)}>
                    <Pencil /> {t('Edit', '編輯')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                    onSelect={() => {
                      if (confirm(t(`Delete account “${a.name}”?`, `刪除帳戶「${a.name}」?`))) del.mutate(a.id)
                    }}
                  >
                    <Trash2 /> {t('Delete', '刪除')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <p className="mt-2 text-[18px] font-semibold tabular-nums">{fmtMoney(a.balance, a.currency)}</p>
          </div>
        ))}
        <button
          onClick={onNew}
          className="flex min-h-[5rem] items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground transition hover:border-brand/40 hover:text-foreground"
        >
          <Plus className="size-4" /> {t('New account', '新增帳戶')}
        </button>
      </div>
    </div>
  )
}

function Budgets({ ledger, t }: { ledger: LedgerDetail; t: Tr }) {
  const range = monthRange()
  const { data: status } = useBudgetStatus(ledger.id, range.from, range.to)
  const expenseCats = ledger.categories.filter((c) => c.kind === 'expense')
  const byCat = new Map((status ?? []).map((s) => [s.category_id, s]))
  return (
    <div className="space-y-2">
      <p className="px-1 text-[12px] text-muted-foreground">
        {t('Monthly budgets', '每月預算')} · {range.label}
      </p>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        {expenseCats.map((c) => (
          <BudgetRow key={c.id} ledgerId={ledger.id} cat={c} status={byCat.get(c.id)} currency={ledger.base_currency} t={t} />
        ))}
        {!expenseCats.length ? <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground/70">{t('No expense categories.', '沒有支出分類。')}</p> : null}
      </div>
    </div>
  )
}

function BudgetRow({ ledgerId, cat, status, currency, t }: { ledgerId: string; cat: LedgerCategory; status?: BudgetStatusItem; currency: string; t: Tr }) {
  const setBudget = useSetBudget()
  const del = useDeleteBudget()
  const limit = status ? Number(status.amount) : 0
  const spent = status ? Number(status.spent) : 0
  const [val, setVal] = useState(limit ? String(limit) : '')
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const over = limit > 0 && spent > limit
  function commit() {
    const amt = Number(val) || 0
    if (amt <= 0) {
      if (status) del.mutate(status.budget_id)
      return
    }
    if (amt !== limit) setBudget.mutate({ ledger_id: ledgerId, category_id: cat.id, amount: amt })
  }
  return (
    <div className="border-b border-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-[14px]">
          {cat.icon ? `${cat.icon} ` : ''}
          {cat.name}
        </span>
        {limit > 0 ? <span className={`text-[12px] tabular-nums ${over ? 'text-red-500' : 'text-muted-foreground'}`}>{fmtMoney(spent, currency)}</span> : null}
        <span className="text-muted-foreground/40">/</span>
        <input
          inputMode="decimal"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          }}
          placeholder={t('set', '設定')}
          className="w-20 rounded border border-input bg-card px-2 py-0.5 text-right text-[13px] tabular-nums outline-none focus:border-brand"
        />
      </div>
      {limit > 0 ? (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${over ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
      ) : null}
    </div>
  )
}

function Reports({ ledger, t }: { ledger: LedgerDetail; t: Tr }) {
  const { data: trend } = useMonthlyTrend(ledger.id, 6)
  const range = monthRange()
  const { data: summary } = useLedgerSummary(ledger.id, range.from, range.to)
  const cur = ledger.base_currency
  const max = Math.max(1, ...(trend ?? []).flatMap((m) => [Number(m.income), Number(m.expense)]))
  const maxCat = Math.max(1, ...(summary?.by_category ?? []).map((c) => Number(c.total)))
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Income vs expense', '收入 vs 支出')}</p>
        <div className="space-y-2.5">
          {(trend ?? []).map((m) => (
            <div key={m.month}>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{m.month}</span>
                <span className="tabular-nums">{fmtMoney(Number(m.income) - Number(m.expense), cur)}</span>
              </div>
              <div className="mt-1 flex h-2 gap-1">
                <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${(Number(m.income) / max) * 50}%` }} />
                <div className="h-full rounded-full bg-red-500/80" style={{ width: `${(Number(m.expense) / max) * 50}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            {t('Income', '收入')}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-red-500" />
            {t('Expense', '支出')}
          </span>
        </div>
      </div>

      {(summary?.by_category ?? []).length ? (
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            {t('This month by category', '本月分類')} · {range.label}
          </p>
          <div className="space-y-2">
            {(summary?.by_category ?? []).slice(0, 10).map((c) => (
              <div key={c.category_id ?? 'none'}>
                <div className="flex items-center justify-between text-[12.5px]">
                  <span>
                    {c.icon ? `${c.icon} ` : ''}
                    {c.name ?? t('Uncategorised', '未分類')}
                  </span>
                  <span className="tabular-nums text-muted-foreground">{fmtMoney(c.total, cur)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(Number(c.total) / maxCat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Split({
  ledger,
  canEdit,
  onAddMember,
  onEditMember,
  onAddSplit,
  t,
}: {
  ledger: LedgerDetail
  canEdit: boolean
  onAddMember: () => void
  onEditMember: (m: MemberBalanceItem) => void
  onAddSplit: () => void
  t: Tr
}) {
  const { lang } = useI18n()
  const { data: members, isLoading } = useBalances(ledger.id)
  const { data: settlements } = useSettlements(ledger.id)
  const removeMember = useRemoveLedgerMember()
  const recordSettlement = useRecordSettlement()
  const delSettlement = useDeleteSettlement()
  const cur = ledger.base_currency
  const list = members ?? []
  const nameOf = (mid: string) => list.find((m) => m.member_id === mid)?.display_name ?? '—'
  const suggestions = useMemo(
    () => settleUp(list.map((m) => ({ member_id: m.member_id, display_name: m.display_name, balance: Number(m.balance) }))),
    [list],
  )

  if (isLoading) return <div className="h-40 animate-pulse rounded-xl bg-card" />

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="flex items-center gap-2">
          <Button variant="brand" size="sm" onClick={onAddSplit} disabled={list.length <= 1}>
            <HandCoins className="size-4" /> {t('Split an expense', '分帳')}
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddMember}>
            <UserPlus className="size-4" /> {t('Add person', '新增成員')}
          </Button>
        </div>
      ) : null}

      {/* Members + balances */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
          <Users className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('People', '成員')}</span>
        </div>
        {list.map((m) => {
          const bal = Number(m.balance)
          const owed = bal > 0.005
          const owes = bal < -0.005
          return (
            <div key={m.member_id} className="group flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-[13px] font-medium uppercase text-muted-foreground">
                {m.display_name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px]">{m.display_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {m.role === 'owner' ? t('Owner', '擁有者') : m.user_id ? t('Collaborator', '協作者') : t('Guest', '掛名')}
                </p>
              </div>
              <span
                className={`shrink-0 text-right text-[13px] font-medium tabular-nums ${
                  owed ? 'text-emerald-600 dark:text-emerald-400' : owes ? 'text-red-500' : 'text-muted-foreground'
                }`}
              >
                {owed ? t('gets back', '可收回') : owes ? t('owes', '應付') : t('settled', '已平')}
                <br />
                {Math.abs(bal) > 0.005 ? fmtMoney(Math.abs(bal), cur) : '—'}
              </span>
              {canEdit && m.role !== 'owner' ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={t('Options', '選項')}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEditMember(m)}>
                      <Pencil /> {t('Edit', '編輯')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                      onSelect={() => {
                        if (Math.abs(bal) > 0.005) {
                          toast.error(t('Settle their balance before removing them.', '請先結清餘額再移除。'))
                          return
                        }
                        if (confirm(t(`Remove ${m.display_name}?`, `移除「${m.display_name}」?`))) removeMember.mutate(m.member_id)
                      }}
                    >
                      <Trash2 /> {t('Remove', '移除')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="w-6 shrink-0" />
              )}
            </div>
          )
        })}
        {list.length <= 1 ? (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground/70">
            {t('Add the people you share costs with, then split an expense.', '新增一起分攤的成員,就能開始分帳。')}
          </p>
        ) : null}
      </div>

      {/* Settle up */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Settle up', '結算')}</span>
        </div>
        {suggestions.length ? (
          suggestions.map((s, i) => (
            <div key={`${s.from_member}-${s.to_member}-${i}`} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
              <p className="min-w-0 flex-1 text-[13.5px]">
                <span className="font-medium">{s.from_name}</span>
                <ArrowRight className="mx-1.5 inline size-3.5 text-muted-foreground" />
                <span className="font-medium">{s.to_name}</span>
              </p>
              <span className="shrink-0 text-[13px] font-medium tabular-nums">{fmtMoney(s.amount, cur)}</span>
              {canEdit ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={recordSettlement.isPending}
                  onClick={() =>
                    recordSettlement.mutate(
                      { ledger_id: ledger.id, from_member: s.from_member, to_member: s.to_member, amount: s.amount },
                      { onSuccess: () => toast.success(t('Recorded', '已記錄')) },
                    )
                  }
                >
                  {t('Mark paid', '標記已付')}
                </Button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground/70">{t('Everyone is settled up. 🎉', '大家都結清了 🎉')}</p>
        )}
      </div>

      {/* Settlement history */}
      {(settlements ?? []).length ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 sm:px-4">
            <Undo2 className="size-3.5 text-muted-foreground" />
            <span className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground/80">{t('Recorded settlements', '已記錄的結算')}</span>
          </div>
          {(settlements ?? []).map((s) => (
            <div key={s.id} className="group flex items-center gap-3 border-b border-border/60 px-3 py-2.5 last:border-b-0 sm:px-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px]">
                  <span className="font-medium">{nameOf(s.from_member)}</span>
                  <ArrowRight className="mx-1.5 inline size-3.5 text-muted-foreground" />
                  <span className="font-medium">{nameOf(s.to_member)}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fmtLedgerDate(s.sett_date, lang)}
                  {s.note ? ` · ${s.note}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-medium tabular-nums">{fmtMoney(s.amount, s.currency)}</span>
              {canEdit ? (
                <button
                  onClick={() => {
                    if (confirm(t('Undo this settlement?', '撤銷這筆結算?'))) delSettlement.mutate(s.id)
                  }}
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                  aria-label={t('Undo', '撤銷')}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
