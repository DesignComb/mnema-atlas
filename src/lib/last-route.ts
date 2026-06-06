// Remember the last in-app route so opening the app drops you back where you were
// (which space + view), instead of always /today.
const KEY = 'mnema:last-route'

// Only these top-level app areas are worth restoring — never public/auth pages.
const APP_PREFIXES = ['/today', '/notes', '/cards', '/graph', '/study', '/decks', '/trips', '/tempo', '/galleon', '/settings']

function isAppRoute(path: string): boolean {
  return APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`))
}

/** Persist a pathname(+search) if it's a real app route. Called on every navigation. */
export function saveLastRoute(pathAndSearch: string): void {
  try {
    if (isAppRoute(pathAndSearch)) localStorage.setItem(KEY, pathAndSearch)
  } catch {
    /* storage unavailable (private mode) — restore just won't happen */
  }
}

/** The saved route to resume on, or null. Validated so a stale/garbage value can't redirect oddly. */
export function getLastRoute(): string | null {
  try {
    const v = localStorage.getItem(KEY)
    return v && isAppRoute(v) ? v : null
  } catch {
    return null
  }
}
