import { describe, it, expect } from 'vitest'
import { createTaskInput, createCaptureInput, resolveCaptureInput, checkInInput } from './schemas'

const UUID = '0b30027c-9d59-4921-8a1a-138892803aa1'

describe('createTaskInput', () => {
  it('accepts a minimal task', () => {
    expect(createTaskInput.safeParse({ title: 'Read' }).success).toBe(true)
  })
  it('accepts a habit with an HH:MM reset_time', () => {
    expect(createTaskInput.safeParse({ title: '原神每日', kind: 'habit', reset_time: '04:00' }).success).toBe(true)
  })
  it('rejects a single-digit-hour reset_time', () => {
    expect(createTaskInput.safeParse({ title: 'x', reset_time: '4:00' }).success).toBe(false)
  })
  it('rejects an empty title', () => {
    expect(createTaskInput.safeParse({ title: '' }).success).toBe(false)
  })
  it('rejects an unknown kind', () => {
    expect(createTaskInput.safeParse({ title: 'x', kind: 'event' }).success).toBe(false)
  })
})

describe('createCaptureInput', () => {
  it('accepts raw capture text', () => {
    expect(createCaptureInput.safeParse({ raw_text: '原神 深淵 6/16' }).success).toBe(true)
  })
  it('rejects empty text', () => {
    expect(createCaptureInput.safeParse({ raw_text: '' }).success).toBe(false)
  })
  it('rejects over-long text (>5000)', () => {
    expect(createCaptureInput.safeParse({ raw_text: 'x'.repeat(5001) }).success).toBe(false)
  })
  it('rejects an unknown source', () => {
    expect(createCaptureInput.safeParse({ raw_text: 'hi', source: 'telepathy' }).success).toBe(false)
  })
})

describe('resolveCaptureInput', () => {
  it('accepts a capture id + back-link ref', () => {
    expect(
      resolveCaptureInput.safeParse({ capture_id: UUID, resolved_kind: 'task', resolved_ref: { id: 'x', title: 't' } }).success,
    ).toBe(true)
  })
  it('rejects a non-uuid capture id', () => {
    expect(resolveCaptureInput.safeParse({ capture_id: 'nope' }).success).toBe(false)
  })
})

describe('checkInInput', () => {
  it('accepts a task id + ISO date', () => {
    expect(checkInInput.safeParse({ task_id: UUID, checkin_date: '2026-06-05' }).success).toBe(true)
  })
  it('rejects a non-ISO date', () => {
    expect(checkInInput.safeParse({ task_id: UUID, checkin_date: 'June 5' }).success).toBe(false)
  })
})
