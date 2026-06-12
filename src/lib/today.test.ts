import { describe, it, expect } from 'vitest'
import { mergeLayout, type LayoutSection } from '@/lib/today'

const KNOWN = ['journal', 'tasks', 'habits', 'notes'] as const

describe('mergeLayout', () => {
  it('returns the defaults (all visible, code order) when nothing is stored', () => {
    expect(mergeLayout(undefined, KNOWN)).toEqual([
      { key: 'journal', hidden: false },
      { key: 'tasks', hidden: false },
      { key: 'habits', hidden: false },
      { key: 'notes', hidden: false },
    ])
    expect(mergeLayout(null, KNOWN)).toEqual(mergeLayout(undefined, KNOWN))
  })

  it('keeps the stored order and hidden flags', () => {
    const stored: LayoutSection[] = [
      { key: 'notes', hidden: false },
      { key: 'journal', hidden: true },
      { key: 'tasks', hidden: false },
      { key: 'habits', hidden: false },
    ]
    expect(mergeLayout(stored, KNOWN)).toEqual(stored)
  })

  it('appends keys the app grew since the save — at the end, visible', () => {
    const stored: LayoutSection[] = [
      { key: 'tasks', hidden: false },
      { key: 'journal', hidden: true },
    ]
    expect(mergeLayout(stored, KNOWN)).toEqual([
      { key: 'tasks', hidden: false },
      { key: 'journal', hidden: true },
      { key: 'habits', hidden: false },
      { key: 'notes', hidden: false },
    ])
  })

  it('drops stored keys the app no longer knows', () => {
    const stored: LayoutSection[] = [
      { key: 'meals', hidden: false }, // removed in a later app version
      { key: 'notes', hidden: true },
      { key: 'journal', hidden: false },
    ]
    expect(mergeLayout(stored, ['journal', 'notes'])).toEqual([
      { key: 'notes', hidden: true },
      { key: 'journal', hidden: false },
    ])
  })

  it('ignores duplicate and malformed stored entries (first occurrence wins)', () => {
    const stored = [
      { key: 'tasks', hidden: true },
      { key: 'tasks', hidden: false },
      { hidden: true },
      null,
      { key: 42, hidden: false },
    ] as unknown as LayoutSection[]
    expect(mergeLayout(stored, ['tasks', 'notes'])).toEqual([
      { key: 'tasks', hidden: true },
      { key: 'notes', hidden: false },
    ])
  })

  it('normalizes a non-boolean hidden to false', () => {
    const stored = [{ key: 'tasks', hidden: 'yes' }] as unknown as LayoutSection[]
    expect(mergeLayout(stored, ['tasks'])).toEqual([{ key: 'tasks', hidden: false }])
  })
})
