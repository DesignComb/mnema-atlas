import { describe, it, expect } from 'vitest'
import { settleUp, type MemberBalance } from './settle'

const m = (id: string, balance: number): MemberBalance => ({ member_id: id, display_name: id, balance })

describe('settleUp', () => {
  it('no balances → no payments', () => {
    expect(settleUp([])).toEqual([])
  })
  it('everyone already even → no payments', () => {
    expect(settleUp([m('a', 0), m('b', 0)])).toEqual([])
  })
  it('two parties: the debtor pays the creditor in full', () => {
    const out = settleUp([m('a', 10), m('b', -10)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ from_member: 'b', to_member: 'a', amount: 10 })
  })
  it('three parties: settles in ≤2 payments and conserves the total', () => {
    const out = settleUp([m('a', 10), m('b', -6), m('c', -4)])
    expect(out).toHaveLength(2)
    expect(out.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(10, 2)
    expect(out.every((p) => p.to_member === 'a')).toBe(true) // the sole creditor receives everything
  })
  it('ignores sub-cent (epsilon) rounding noise', () => {
    expect(settleUp([m('a', 0.004), m('b', -0.004)])).toEqual([])
  })
  it('a larger mix conserves: total paid == total owed', () => {
    const balances = [m('a', 25), m('b', 5), m('c', -12), m('d', -18)]
    const out = settleUp(balances)
    const owed = balances.filter((b) => b.balance < 0).reduce((s, b) => s - b.balance, 0)
    expect(out.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(owed, 2)
  })
})
