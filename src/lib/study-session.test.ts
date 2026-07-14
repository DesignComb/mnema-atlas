import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearAllStudySessions,
  clearStudySession,
  patchStudySession,
  restoreStudySession,
  saveStudySession,
} from './study-session'

const K1 = 'deck-1||'
const K2 = '|physics|'
const K3 = '||starred'
const K4 = 'deck-2||'
const ALL = [K1, K2, K3, K4]

beforeEach(() => {
  // module-level store — reset between tests
  for (const k of ALL) clearStudySession(k)
})

describe('saveStudySession / restoreStudySession', () => {
  it('round-trips the state for the same key', () => {
    const state = { queue: [{ id: 'c1' }], idx: 2 }
    saveStudySession(K1, state)
    expect(restoreStudySession(K1)).toBe(state)
  })

  it('returns null when nothing was saved', () => {
    expect(restoreStudySession(K1)).toBeNull()
  })

  it('returns null for a different key (filter changed)', () => {
    saveStudySession(K1, { idx: 1 })
    expect(restoreStudySession(K2)).toBeNull()
  })

  it('is non-consuming: restoring twice returns the same session (StrictMode double-init)', () => {
    saveStudySession(K1, { idx: 3 })
    expect(restoreStudySession(K1)).toEqual({ idx: 3 })
    expect(restoreStudySession(K1)).toEqual({ idx: 3 })
  })

  it('sessions under different keys coexist', () => {
    saveStudySession(K1, { idx: 1 })
    saveStudySession(K2, { idx: 9 })
    expect(restoreStudySession(K1)).toEqual({ idx: 1 })
    expect(restoreStudySession(K2)).toEqual({ idx: 9 })
  })

  it('keeps at most 3 sessions, evicting the least recently saved', () => {
    saveStudySession(K1, { idx: 1 })
    saveStudySession(K2, { idx: 2 })
    saveStudySession(K3, { idx: 3 })
    saveStudySession(K4, { idx: 4 })
    expect(restoreStudySession(K1)).toBeNull()
    expect(restoreStudySession(K2)).toEqual({ idx: 2 })
    expect(restoreStudySession(K3)).toEqual({ idx: 3 })
    expect(restoreStudySession(K4)).toEqual({ idx: 4 })
  })

  it('re-saving a key refreshes its eviction order', () => {
    saveStudySession(K1, { idx: 1 })
    saveStudySession(K2, { idx: 2 })
    saveStudySession(K3, { idx: 3 })
    saveStudySession(K1, { idx: 10 }) // K1 becomes most recent
    saveStudySession(K4, { idx: 4 }) // evicts K2, not K1
    expect(restoreStudySession(K1)).toEqual({ idx: 10 })
    expect(restoreStudySession(K2)).toBeNull()
    expect(restoreStudySession(K3)).toEqual({ idx: 3 })
    expect(restoreStudySession(K4)).toEqual({ idx: 4 })
  })

  it('expires after 30 minutes of inactivity', () => {
    const t0 = 1_000_000
    saveStudySession(K1, { idx: 1 }, t0)
    expect(restoreStudySession(K1, t0 + 30 * 60_000)).toEqual({ idx: 1 })
    expect(restoreStudySession(K1, t0 + 30 * 60_000 + 1)).toBeNull()
    // the expired slot is dropped for good, not just hidden
    expect(restoreStudySession(K1, t0)).toBeNull()
  })

  it('re-saving refreshes the inactivity clock', () => {
    const t0 = 1_000_000
    saveStudySession(K1, { idx: 1 }, t0)
    saveStudySession(K1, { idx: 2 }, t0 + 25 * 60_000)
    expect(restoreStudySession(K1, t0 + 45 * 60_000)).toEqual({ idx: 2 })
  })
})

describe('clearStudySession', () => {
  it('drops the saved session for its key', () => {
    saveStudySession(K1, { idx: 1 })
    clearStudySession(K1)
    expect(restoreStudySession(K1)).toBeNull()
  })

  it("leaves another key's session alone", () => {
    saveStudySession(K1, { idx: 1 })
    clearStudySession(K2)
    expect(restoreStudySession(K1)).toEqual({ idx: 1 })
  })
})

describe('clearAllStudySessions', () => {
  it('drops every session (sign-out on a shared device)', () => {
    saveStudySession(K1, { idx: 1 })
    saveStudySession(K2, { idx: 2 })
    clearAllStudySessions()
    expect(restoreStudySession(K1)).toBeNull()
    expect(restoreStudySession(K2)).toBeNull()
  })
})

describe('patchStudySession', () => {
  it('updates the saved state through the patch function', () => {
    saveStudySession(K1, { idx: 1, unsaved: 0 })
    patchStudySession<{ idx: number; unsaved: number }>(K1, (s) => ({ ...s, unsaved: s.unsaved + 1 }))
    expect(restoreStudySession(K1)).toEqual({ idx: 1, unsaved: 1 })
  })

  it('no-ops when nothing is saved for the key', () => {
    patchStudySession<{ idx: number }>(K1, (s) => ({ ...s, idx: 9 }))
    expect(restoreStudySession(K1)).toBeNull()
  })

  it('no-ops on an expired session', () => {
    const t0 = 1_000_000
    saveStudySession(K1, { idx: 1 }, t0)
    patchStudySession<{ idx: number }>(K1, (s) => ({ ...s, idx: 9 }), t0 + 31 * 60_000)
    expect(restoreStudySession(K1, t0 + 31 * 60_000)).toBeNull()
  })

  it('refreshes the inactivity clock', () => {
    const t0 = 1_000_000
    saveStudySession(K1, { idx: 1 }, t0)
    patchStudySession<{ idx: number }>(K1, (s) => ({ ...s, idx: 2 }), t0 + 25 * 60_000)
    expect(restoreStudySession(K1, t0 + 45 * 60_000)).toEqual({ idx: 2 })
  })
})
