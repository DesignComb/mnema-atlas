/**
 * Greedy "settle up" — turn a set of member balances into the minimal-ish list of
 * payments that zeroes everyone out. Shared by the browser (Split view) and the
 * Worker (the `suggest_settlement` AI tool), so the math is identical everywhere.
 *
 * A positive balance = the member is owed money (creditor); negative = they owe
 * (debtor). We repeatedly match the biggest creditor with the biggest debtor and
 * transfer min(|a|, |b|). This is not provably minimal (that's NP-hard) but is the
 * standard Splitwise-style heuristic and produces near-optimal, intuitive results.
 */

export interface MemberBalance {
  member_id: string
  display_name: string
  balance: number
}

export interface SettlementSuggestion {
  from_member: string
  from_name: string
  to_member: string
  to_name: string
  amount: number
}

const EPSILON = 0.005 // sub-cent noise from numeric(16,2) rounding

export function settleUp(balances: MemberBalance[]): SettlementSuggestion[] {
  const creditors = balances
    .filter((b) => b.balance > EPSILON)
    .map((b) => ({ ...b }))
    .sort((a, b) => b.balance - a.balance)
  const debtors = balances
    .filter((b) => b.balance < -EPSILON)
    .map((b) => ({ ...b, balance: -b.balance }))
    .sort((a, b) => b.balance - a.balance)

  const out: SettlementSuggestion[] = []
  let i = 0
  let j = 0
  while (i < creditors.length && j < debtors.length) {
    const amount = Math.round(Math.min(creditors[i].balance, debtors[j].balance) * 100) / 100
    if (amount > 0) {
      out.push({
        from_member: debtors[j].member_id,
        from_name: debtors[j].display_name,
        to_member: creditors[i].member_id,
        to_name: creditors[i].display_name,
        amount,
      })
    }
    creditors[i].balance -= amount
    debtors[j].balance -= amount
    if (creditors[i].balance <= EPSILON) i++
    if (debtors[j].balance <= EPSILON) j++
  }
  return out
}
