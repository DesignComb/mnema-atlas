/**
 * Small in-memory store for in-progress study sessions, so navigating away
 * mid-review (e.g. tapping a [[wikilink]] on a card) and coming back resumes
 * at the same card instead of restarting the queue.
 *
 * Module memory on purpose: an SPA navigation never reloads the page, and the
 * snapshot holds non-serializable values (the undo entry's write Promise), so
 * web storage isn't an option. A real reload or a native process death drops
 * every session — a deliberate fresh start, and a safe one: each grade was
 * already persisted per card, and Again-requeued cards come back on their own
 * because their server due (+1m) has long passed by relaunch.
 *
 * A few sessions are kept (LRU), keyed by the study filter, so briefly opening
 * another deck/tag's study screen doesn't evict an in-progress session.
 */

const MAX_AGE_MS = 30 * 60_000 // expire after 30 min of inactivity
const MAX_SESSIONS = 3

// Map iteration order is insertion order; save() re-inserts its key, so the
// first key is always the least recently saved — the one to evict.
const slots = new Map<string, { savedAt: number; state: unknown }>()

/** Mirror the live session. `key` identifies the filter (deck | tag | starred). */
export function saveStudySession(key: string, state: unknown, now = Date.now()): void {
  slots.delete(key)
  slots.set(key, { savedAt: now, state })
  while (slots.size > MAX_SESSIONS) {
    const oldest = slots.keys().next().value
    if (oldest === undefined) break
    slots.delete(oldest)
  }
}

/** Drop the saved session for `key` (other filters' sessions are untouched). */
export function clearStudySession(key: string): void {
  slots.delete(key)
}

/**
 * Forget every session. Keys carry no user identity, and on native sign-out
 * doesn't reload the page — without this purge the next account on a shared
 * device would resume (and read) the previous account's cards.
 */
export function clearAllStudySessions(): void {
  slots.clear()
}

/**
 * The saved session for `key`, or null if there is none or it expired.
 * Non-consuming on success: StrictMode may run the caller's useState
 * initializer twice.
 */
export function restoreStudySession<T>(key: string, now = Date.now()): T | null {
  const slot = slots.get(key)
  if (!slot) return null
  if (now - slot.savedAt > MAX_AGE_MS) {
    slots.delete(key)
    return null
  }
  return slot.state as T
}

/**
 * Update a saved session in place — for callbacks that outlive the study
 * screen (a discard-undo tapped from another route, a grade write failing
 * after navigation), whose setState calls would land on an unmounted
 * component. No-op when there is no live session to patch.
 */
export function patchStudySession<T>(key: string, fn: (state: T) => T, now = Date.now()): void {
  const state = restoreStudySession<T>(key, now)
  if (state !== null) saveStudySession(key, fn(state), now)
}
