import { useSyncExternalStore } from 'react'
import { SPACES, type SpaceKey } from '@/components/app-shell/spaces'

/**
 * Which spaces the user pinned to the mobile bottom bar, and in what order.
 * A per-device UI preference (localStorage) — not synced, not in the DB. The
 * bottom bar shows these (max 4) split around the centre Capture button; every
 * other space stays reachable in the ☰ drawer. Customised via BottomTabsCustomize.
 */
const KEY = 'mnema:pinned-spaces'
export const MAX_PINNED = 4
const DEFAULT: SpaceKey[] = ['study', 'tempo', 'galleon', 'health']

const VALID = new Set<SpaceKey>(SPACES.map((s) => s.key))

function read(): SpaceKey[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT
    const clean = parsed.filter((k): k is SpaceKey => typeof k === 'string' && VALID.has(k as SpaceKey)).slice(0, MAX_PINNED)
    return clean.length ? clean : DEFAULT
  } catch {
    return DEFAULT
  }
}

// External store: a memoised snapshot (stable reference until a write) so
// useSyncExternalStore doesn't loop, plus a single cross-tab storage listener.
let cache: SpaceKey[] | null = null
const listeners = new Set<() => void>()
let wired = false

function emit() {
  cache = null
  listeners.forEach((l) => l())
}

function subscribe(cb: () => void) {
  if (!wired && typeof window !== 'undefined') {
    wired = true
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) emit()
    })
  }
  listeners.add(cb)
  return () => listeners.delete(cb)
}

function getSnapshot(): SpaceKey[] {
  if (!cache) cache = read()
  return cache
}

export function setPinnedSpaces(next: SpaceKey[]) {
  const clean = next.filter((k) => VALID.has(k)).slice(0, MAX_PINNED)
  localStorage.setItem(KEY, JSON.stringify(clean))
  emit()
}

export function usePinnedSpaces(): SpaceKey[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT)
}
