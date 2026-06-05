import { describe, it, expect } from 'vitest'
import {
  buildRRule,
  parseRRule,
  shortRecurrenceLabel,
  computeOccurrence,
  habitTodayISO,
  formatResetTime,
} from '@/lib/recurrence'

const at = (iso: string) => new Date(iso) // an absolute instant; habitTodayISO reads wall-clock in the given tz

describe('habitTodayISO', () => {
  it('a null reset = the calendar date in the tz', () => {
    expect(habitTodayISO(null, 'Asia/Taipei', at('2026-06-05T10:00:00+08:00'))).toBe('2026-06-05')
  })
  it('a 00:00 reset behaves like the calendar date', () => {
    expect(habitTodayISO('00:00', 'Asia/Taipei', at('2026-06-05T10:00:00+08:00'))).toBe('2026-06-05')
  })
  it('before a 04:00 reset still counts as the previous day', () => {
    expect(habitTodayISO('04:00', 'Asia/Taipei', at('2026-06-05T02:00:00+08:00'))).toBe('2026-06-04')
  })
  it('after a 04:00 reset counts as today', () => {
    expect(habitTodayISO('04:00', 'Asia/Taipei', at('2026-06-05T05:00:00+08:00'))).toBe('2026-06-05')
  })
  it('a 14:00 reset: the morning is still the previous day, the afternoon is today', () => {
    expect(habitTodayISO('14:00', 'Asia/Taipei', at('2026-06-05T10:00:00+08:00'))).toBe('2026-06-04')
    expect(habitTodayISO('14:00', 'Asia/Taipei', at('2026-06-05T15:00:00+08:00'))).toBe('2026-06-05')
  })
  it('rolls back across a month boundary', () => {
    expect(habitTodayISO('04:00', 'Asia/Taipei', at('2026-06-01T02:00:00+08:00'))).toBe('2026-05-31')
  })
  it('accepts a stored HH:MM:SS time', () => {
    expect(habitTodayISO('04:00:00', 'Asia/Taipei', at('2026-06-05T03:59:00+08:00'))).toBe('2026-06-04')
  })
})

describe('formatResetTime', () => {
  it('trims seconds to HH:MM', () => expect(formatResetTime('04:00:00')).toBe('04:00'))
  it('passes a plain HH:MM through', () => expect(formatResetTime('14:00')).toBe('14:00'))
  it('is null when unset', () => expect(formatResetTime(null)).toBeNull())
  it('is null on a malformed value', () => expect(formatResetTime('not-a-time')).toBeNull())
})

describe('RRULE build ⇄ parse', () => {
  it('builds a bare daily rule', () => expect(buildRRule('DAILY', 1, [])).toBe('FREQ=DAILY'))
  it('round-trips weekly with interval + weekdays', () => {
    const rule = buildRRule('WEEKLY', 2, ['MO', 'WE'])
    expect(rule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE')
    expect(parseRRule(rule)).toEqual({ freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'] })
  })
  it('parses null as "none"', () => expect(parseRRule(null)).toEqual({ freq: 'none', interval: 1, byday: [] }))
})

describe('shortRecurrenceLabel', () => {
  const t = (en: string) => en
  it('labels daily', () => expect(shortRecurrenceLabel('FREQ=DAILY', t)).toBe('Daily'))
  it('labels every-N-weeks', () => expect(shortRecurrenceLabel('FREQ=WEEKLY;INTERVAL=2', t)).toBe('Every 2 weeks'))
  it('is null for no rule', () => expect(shortRecurrenceLabel(null, t)).toBeNull())
})

describe('computeOccurrence', () => {
  it('inclusive returns the same day', async () => {
    expect(await computeOccurrence('FREQ=DAILY', '2026-06-05', true)).toBe('2026-06-05')
  })
  it('exclusive advances to the next day', async () => {
    expect(await computeOccurrence('FREQ=DAILY', '2026-06-05', false)).toBe('2026-06-06')
  })
})
