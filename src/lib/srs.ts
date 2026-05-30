import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs'
import type { CardRow } from './database.types'

/**
 * Shared FSRS logic. The authoritative grade (`next`) ideally runs server-side
 * (Worker/Edge); the client uses `previewIntervals` only to label the rating
 * buttons. Both paths agree because they share this module.
 *
 * Golden rule: all timestamps cross the wire as ISO/UTC strings and are
 * re-hydrated to `Date` here before ts-fsrs ever sees them.
 */

const params = generatorParameters({ enable_fuzz: true, enable_short_term: true })
export const scheduler = fsrs(params)

export { Rating, State }

/** Re-hydrate a DB row into a ts-fsrs Card (string → Date). */
export function rowToCard(row: CardRow): Card {
  if (row.stability == null || row.difficulty == null) {
    // Never reviewed yet → a fresh empty card pinned to its stored due date.
    const empty = createEmptyCard(new Date(row.due))
    empty.reps = row.reps
    empty.lapses = row.lapses
    empty.state = row.state as State
    empty.learning_steps = row.learning_steps
    return empty
  }
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  }
}

/** Serialise a ts-fsrs Card to the jsonb shape record_review expects. */
function cardToJson(card: Card) {
  return {
    state: card.state,
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    last_review: card.last_review ? card.last_review.toISOString() : null,
  }
}

export interface GradeResult {
  card: ReturnType<typeof cardToJson>
  log: Record<string, unknown>
}

/** Grade a card → serialised {card, log} ready for the record_review RPC. */
export function grade(row: CardRow, rating: Grade, now: Date = new Date()): GradeResult {
  const { card, log } = scheduler.next(rowToCard(row), now, rating)
  return {
    card: cardToJson(card),
    log: {
      rating: log.rating,
      state: log.state,
      due: log.due.toISOString(),
      stability: log.stability,
      difficulty: log.difficulty,
      elapsed_days: log.elapsed_days,
      last_elapsed_days: log.last_elapsed_days,
      scheduled_days: log.scheduled_days,
      learning_steps: log.learning_steps,
      review: log.review.toISOString(),
    },
  }
}

export interface IntervalHint {
  rating: Grade
  label: string
}

const RATING_ORDER: Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]

function humanInterval(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime()
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (ms < hour) return `${Math.max(1, Math.round(ms / min))}m`
  if (ms < day) return `${Math.round(ms / hour)}h`
  if (ms < 30 * day) return `${Math.round(ms / day)}d`
  if (ms < 365 * day) return `${Math.round(ms / (30 * day))}mo`
  return `${(ms / (365 * day)).toFixed(1)}y`
}

/** The "next interval" labels shown on the Again/Hard/Good/Easy buttons. */
export function previewIntervals(row: CardRow, now: Date = new Date()): IntervalHint[] {
  const preview = scheduler.repeat(rowToCard(row), now)
  return RATING_ORDER.map((rating) => ({
    rating,
    label: humanInterval(now, preview[rating].card.due),
  }))
}

export const RATING_META: Record<Grade, { label: string; key: string; tone: string }> = {
  [Rating.Again]: { label: 'Again', key: '1', tone: 'again' },
  [Rating.Hard]: { label: 'Hard', key: '2', tone: 'hard' },
  [Rating.Good]: { label: 'Good', key: '3', tone: 'good' },
  [Rating.Easy]: { label: 'Easy', key: '4', tone: 'easy' },
}
