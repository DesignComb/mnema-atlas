/**
 * Map an internal error to a safe, client-facing message. External AIs hit this
 * API, so a raw Postgres error (column names, constraint definitions, the
 * search_path, etc.) must never reach them — that would leak schema shape.
 * The real error is logged for server-side debugging (Cloudflare tail).
 */
export function cleanError(e: unknown): { message: string; status: 400 | 403 | 404 | 500 } {
  const raw = e instanceof Error ? e.message : String(e)
  console.error('[mnema] tool error:', raw)

  if (/forbidden|cannot act on behalf|add-only|not authorized|permission denied|42501/i.test(raw))
    return { message: 'Forbidden: this key is not allowed to do that.', status: 403 }
  if (/not found|no rows|0 rows|P0002/i.test(raw))
    return { message: "Not found, or you don't have access to it.", status: 404 }
  if (/duplicate key|unique constraint|already exists/i.test(raw))
    return { message: 'That already exists.', status: 400 }
  if (/invalid input|violates|invalid text representation|22\d{3}/i.test(raw))
    return { message: 'Invalid input.', status: 400 }
  return { message: 'Something went wrong. Please try again.', status: 500 }
}
