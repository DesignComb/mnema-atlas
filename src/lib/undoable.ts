import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'

/**
 * Gmail/Linear-style undoable deletes (UI/UX audit QW1).
 *
 * The row disappears instantly (screens filter their lists on `useHiddenKeys`),
 * a toast offers Undo, and the real API call only fires after a grace window.
 * Undo is free because nothing was sent yet — habits keep their streaks and
 * check-in history, transactions keep their splits.
 *
 * The hidden-key registry lives outside react-query on purpose: a cache-level
 * optimistic removal would be clobbered by any refetch during the grace window
 * (e.g. completing another task invalidates ['tasks']), while a render-time
 * filter survives them all.
 *
 * Known limit: if the tab dies inside the grace window the delete is lost and
 * the item resurfaces next session — the safe direction to fail. `pagehide` /
 * `visibilitychange` flushes narrow that window to near zero.
 */

const GRACE_MS = 5000

type Pending = {
  timer: ReturnType<typeof setTimeout>
  /** Commit now (used by re-delete of the same key and the pagehide flush). */
  fire: () => void
}

const pending = new Map<string, Pending>()
let hidden: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function setHidden(next: Set<string>) {
  hidden = next
  for (const l of listeners) l()
}
function hide(key: string) {
  const next = new Set(hidden)
  next.add(key)
  setHidden(next)
}
function unhide(key: string) {
  if (!hidden.has(key)) return
  const next = new Set(hidden)
  next.delete(key)
  setHidden(next)
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Entity keys (e.g. `task:<id>`) pending an undoable delete — filter rows on this. */
export function useHiddenKeys(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => hidden)
}

export function undoableDelete(opts: {
  /** Unique entity key, e.g. `task:${id}` — the same string screens filter on. */
  key: string
  message: string
  undoLabel: string
  /** Shown if the deferred API call ultimately fails (the row reappears). */
  errorMessage: string
  commit: () => Promise<unknown>
  /**
   * Invalidate the relevant queries. Awaited before the key unhides so the row
   * never flashes back between cache-drop and refetch.
   */
  onSettled?: () => Promise<unknown> | unknown
}) {
  // Deleting an entity whose previous delete is still in its grace window:
  // commit the old one now so the two never interleave.
  const prior = pending.get(opts.key)
  if (prior) {
    clearTimeout(prior.timer)
    prior.fire()
  }

  hide(opts.key)

  const toastId = toast(opts.message, {
    action: {
      label: opts.undoLabel,
      onClick: () => {
        const p = pending.get(opts.key)
        if (!p) return // already committed (e.g. flushed on tab hide)
        clearTimeout(p.timer)
        pending.delete(opts.key)
        unhide(opts.key)
      },
    },
    // The toast leaves just before the delete commits, so Undo is never shown
    // for an already-committed delete.
    duration: GRACE_MS - 700,
  })

  const fire = () => {
    pending.delete(opts.key)
    toast.dismiss(toastId)
    void opts.commit()
      .then(async () => {
        await opts.onSettled?.()
      })
      .catch(() => {
        toast.error(opts.errorMessage)
      })
      .finally(() => unhide(opts.key))
  }

  const timer = setTimeout(fire, GRACE_MS)
  pending.set(opts.key, { timer, fire })
}

/** Commit every pending delete immediately — the page is going away. */
function flushAll() {
  for (const p of Array.from(pending.values())) {
    clearTimeout(p.timer)
    p.fire()
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll()
  })
}
