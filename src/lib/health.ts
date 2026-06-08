import type { HealthLogKind, HealthModule } from '@shared/schemas'
import type { HealthLogRow } from './database.types'

/** The toggleable health modules (health_settings.enabled_modules). */
export const HEALTH_MODULES: { key: HealthModule; en: string; zh: string }[] = [
  { key: 'vitals', en: 'Body & vitals', zh: '體態與生命徵象' },
  { key: 'activity', en: 'Activity & sleep', zh: '作息與活動' },
  { key: 'nutrition', en: 'Nutrition', zh: '飲食營養' },
  { key: 'meds', en: 'Medications & symptoms', zh: '用藥與症狀' },
  { key: 'journal', en: 'Journal & mood', zh: '日記與心情' },
]

/** Which input fields a kind uses. value/value2 are numeric, text is free text. */
export type KindField = 'value' | 'value2' | 'text'

export interface KindMeta {
  kind: HealthLogKind
  module: HealthModule
  en: string
  zh: string
  unit: string
  fields: KindField[]
}

export const HEALTH_KINDS: KindMeta[] = [
  { kind: 'weight', module: 'vitals', en: 'Weight', zh: '體重', unit: 'kg', fields: ['value'] },
  { kind: 'body_fat', module: 'vitals', en: 'Body fat', zh: '體脂', unit: '%', fields: ['value'] },
  { kind: 'waist', module: 'vitals', en: 'Waist', zh: '腰圍', unit: 'cm', fields: ['value'] },
  { kind: 'blood_pressure', module: 'vitals', en: 'Blood pressure', zh: '血壓', unit: 'mmHg', fields: ['value', 'value2'] },
  { kind: 'heart_rate', module: 'vitals', en: 'Heart rate', zh: '心率', unit: 'bpm', fields: ['value'] },
  { kind: 'blood_glucose', module: 'vitals', en: 'Blood glucose', zh: '血糖', unit: 'mg/dL', fields: ['value'] },
  { kind: 'temperature', module: 'vitals', en: 'Temperature', zh: '體溫', unit: '°C', fields: ['value'] },
  { kind: 'sleep', module: 'activity', en: 'Sleep', zh: '睡眠', unit: 'h', fields: ['value'] },
  { kind: 'workout', module: 'activity', en: 'Workout', zh: '運動', unit: 'min', fields: ['value', 'text'] },
  { kind: 'water', module: 'activity', en: 'Water', zh: '喝水', unit: 'ml', fields: ['value'] },
  { kind: 'meal', module: 'nutrition', en: 'Meal', zh: '餐點', unit: 'kcal', fields: ['text', 'value'] },
  { kind: 'meds', module: 'meds', en: 'Medication taken', zh: '服藥', unit: '', fields: ['text'] },
  { kind: 'symptom', module: 'meds', en: 'Symptom', zh: '症狀', unit: '', fields: ['text'] },
  { kind: 'other', module: 'vitals', en: 'Other', zh: '其他', unit: '', fields: ['text', 'value'] },
]

const KIND_BY = Object.fromEntries(HEALTH_KINDS.map((k) => [k.kind, k])) as Record<HealthLogKind, KindMeta>
export function kindMeta(kind: string): KindMeta | undefined {
  return KIND_BY[kind as HealthLogKind]
}

/** Kinds visible given the user's enabled modules (defaults to all if unset). */
export function kindsForModules(enabled: string[] | undefined): KindMeta[] {
  const set = new Set(enabled ?? HEALTH_MODULES.map((m) => m.key))
  return HEALTH_KINDS.filter((k) => set.has(k.module))
}

/** Local YYYY-MM-DD (the user's calendar day, not UTC). */
export function localTodayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const MOOD_FACES = ['😣', '🙁', '😐', '🙂', '😄']
export const MOOD_EN = ['Awful', 'Low', 'Okay', 'Good', 'Great']
export const MOOD_ZH = ['很差', '低落', '普通', '不錯', '很好']

/** One-line value display for a log row, e.g. "72.5 kg" or "120/80 mmHg". */
export function formatLogValue(row: Pick<HealthLogRow, 'kind' | 'value' | 'value2' | 'unit' | 'text_value'>): string {
  const meta = kindMeta(row.kind)
  const unit = row.unit ?? meta?.unit ?? ''
  if (row.kind === 'blood_pressure' && row.value != null && row.value2 != null) {
    return `${row.value}/${row.value2}${unit ? ` ${unit}` : ''}`
  }
  const parts: string[] = []
  if (row.text_value) parts.push(row.text_value)
  if (row.value != null) parts.push(`${row.value}${unit ? ` ${unit}` : ''}`)
  return parts.join(' · ') || (meta ? '' : row.kind)
}
