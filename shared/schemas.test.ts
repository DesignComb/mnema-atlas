import { describe, it, expect } from 'vitest'
import {
  createTaskInput,
  createCaptureInput,
  resolveCaptureInput,
  checkInInput,
  logHealthInput,
  setJournalEntryInput,
  setHealthSettingsInput,
  createMedicationInput,
  createRecipeInput,
  addShoppingItemsInput,
  setMealPlanInput,
  setSubscriptionInput,
  setTaskUrlInput,
} from './schemas'

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

// ── Mnema Vitals (health) ──
describe('logHealthInput', () => {
  it('accepts a weight log', () => {
    expect(logHealthInput.safeParse({ kind: 'weight', value: 72.5, unit: 'kg', logged_date: '2026-06-07' }).success).toBe(true)
  })
  it('accepts a meal with a Chinese description + macros meta', () => {
    expect(logHealthInput.safeParse({ kind: 'meal', text_value: '雞腿便當', value: 800, meta: { protein: 30 } }).success).toBe(true)
  })
  it('accepts blood pressure with systolic/diastolic', () => {
    expect(logHealthInput.safeParse({ kind: 'blood_pressure', value: 120, value2: 80 }).success).toBe(true)
  })
  it('rejects an unknown kind', () => {
    expect(logHealthInput.safeParse({ kind: 'vibes', value: 1 }).success).toBe(false)
  })
})

describe('setJournalEntryInput', () => {
  it('accepts a mood + body', () => {
    expect(setJournalEntryInput.safeParse({ mood: 4, energy: 3, body: '今天還不錯' }).success).toBe(true)
  })
  it('rejects a mood outside 1–5', () => {
    expect(setJournalEntryInput.safeParse({ mood: 6 }).success).toBe(false)
  })
})

describe('setHealthSettingsInput', () => {
  it('accepts an enabled-modules subset', () => {
    expect(setHealthSettingsInput.safeParse({ enabled_modules: ['vitals', 'journal'], weight_unit: 'lb' }).success).toBe(true)
  })
  it('rejects an unknown module', () => {
    expect(setHealthSettingsInput.safeParse({ enabled_modules: ['astrology'] }).success).toBe(false)
  })
})

describe('createMedicationInput', () => {
  it('accepts a med with HH:MM times', () => {
    expect(createMedicationInput.safeParse({ name: '維他命 D', dosage: '1 顆', times: ['08:00', '20:00'] }).success).toBe(true)
  })
  it('rejects a malformed time', () => {
    expect(createMedicationInput.safeParse({ name: 'x', times: ['8am'] }).success).toBe(false)
  })
})

// ── Mnema Kitchen ──
describe('createRecipeInput', () => {
  it('accepts a recipe with structured ingredients', () => {
    expect(
      createRecipeInput.safeParse({ title: '滷肉飯', ingredients: [{ name: '豬絞肉', quantity: '300', unit: 'g' }], servings: 2 }).success,
    ).toBe(true)
  })
  it('rejects an empty title', () => {
    expect(createRecipeInput.safeParse({ title: '' }).success).toBe(false)
  })
})

describe('addShoppingItemsInput', () => {
  it('accepts one or more items', () => {
    expect(addShoppingItemsInput.safeParse({ items: [{ name: '雞蛋' }, { name: '牛奶', quantity: '1' }] }).success).toBe(true)
  })
  it('rejects an empty list', () => {
    expect(addShoppingItemsInput.safeParse({ items: [] }).success).toBe(false)
  })
})

describe('setMealPlanInput', () => {
  it('accepts a slot + recipe', () => {
    expect(setMealPlanInput.safeParse({ plan_date: '2026-06-07', slot: 'dinner', recipe_id: UUID }).success).toBe(true)
  })
  it('rejects an unknown slot', () => {
    expect(setMealPlanInput.safeParse({ slot: 'brunch' }).success).toBe(false)
  })
})

// ── Galleon subscriptions ──
describe('setSubscriptionInput', () => {
  it('accepts a subscription', () => {
    expect(setSubscriptionInput.safeParse({ ledger_id: UUID, name: 'Netflix', amount: 390, renewal_date: '2026-07-01' }).success).toBe(true)
  })
  it('rejects a non-ISO renewal date', () => {
    expect(setSubscriptionInput.safeParse({ ledger_id: UUID, name: 'x', amount: 1, renewal_date: '7/1' }).success).toBe(false)
  })
})

// ── Tempo task hyperlink ──
describe('setTaskUrlInput', () => {
  it('accepts a url (and an empty string to clear)', () => {
    expect(setTaskUrlInput.safeParse({ task_id: UUID, url: 'https://example.com' }).success).toBe(true)
    expect(setTaskUrlInput.safeParse({ task_id: UUID, url: '' }).success).toBe(true)
  })
  it('rejects a non-uuid task id', () => {
    expect(setTaskUrlInput.safeParse({ task_id: 'nope', url: '' }).success).toBe(false)
  })
})
