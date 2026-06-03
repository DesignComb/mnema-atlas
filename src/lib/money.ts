/** Money + date helpers for the Galleon space. */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function fmtMoney(amount: number | string | null, currency = 'TWD'): string {
  const n = Number(amount) || 0
  try {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'TWD' || currency === 'JPY' ? 0 : 2,
    }).format(n)
  } catch {
    return `${currency} ${n.toLocaleString()}`
  }
}

export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** First/last day of the month containing `d` (local), plus a YYYY/MM label. */
export function monthRange(d = new Date()): { from: string; to: string; label: string } {
  const y = d.getFullYear()
  const m = d.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  return { from: `${y}-${pad(m + 1)}-01`, to: `${y}-${pad(m + 1)}-${pad(last)}`, label: `${y}/${pad(m + 1)}` }
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export const ACCOUNT_TYPE_LABEL: Record<string, [string, string]> = {
  cash: ['Cash', '現金'],
  bank: ['Bank', '銀行'],
  credit: ['Credit card', '信用卡'],
  ewallet: ['E-wallet', '電子錢包'],
  investment: ['Investment', '投資'],
}
