/**
 * Map an internal error to a safe, client-facing message. External AIs hit this
 * API, so a raw Postgres error (column names, constraint definitions, the
 * search_path, etc.) must never reach them — that would leak schema shape.
 * The real error is logged for server-side debugging (Cloudflare tail).
 *
 * Exception: our own SECURITY DEFINER RPCs `raise exception` business-rule
 * violations with hand-written, schema-free messages (e.g. "splits must sum to
 * the amount"). Those ARE useful to pass back so the caller's AI can self-correct,
 * so we surface them verbatim — gated on the SQLSTATE we author them with and a
 * leak filter, never the generic Postgres-generated messages.
 */

/** Error that carries the Postgres SQLSTATE through to cleanError(). */
export class RpcError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'RpcError'
    this.code = code
  }
}

// SQLSTATEs our RPCs use for hand-authored business-rule `raise exception`s:
// P0001 = bare `raise exception '...'`, 22023 = our validation raises
// (`using errcode = '22023'`). Postgres rarely emits these itself, and never
// with schema details, so their text is safe to surface.
const AUTHORED_CODES = new Set(['P0001', '22023'])

// Postgres-generated fragments that would leak schema shape — if any appear we
// fall back to a generic message even for an "authored" SQLSTATE.
const LEAK =
  /relation "|column "|constraint "|does not exist|invalid input syntax for|search_path|pg_catalog|operator |function [a-z0-9_.]+\(/i

export function cleanError(e: unknown): { message: string; status: 400 | 403 | 404 | 500 } {
  const raw = e instanceof Error ? e.message : String(e)
  const code = e instanceof RpcError ? e.code : undefined
  console.error('[mnema] tool error:', code ?? '-', raw)

  // Surface our own validation reasons (first line only — drop any CONTEXT/QUERY tail).
  if (code && AUTHORED_CODES.has(code) && raw && !LEAK.test(raw)) {
    return { message: raw.split('\n')[0].trim(), status: 400 }
  }

  if (code === '42501' || /forbidden|cannot act on behalf|add-only|not authorized|permission denied|42501/i.test(raw))
    return { message: 'Forbidden: this key is not allowed to do that.', status: 403 }
  if (code === 'P0002' || /not found|no rows|0 rows|P0002/i.test(raw))
    return { message: "Not found, or you don't have access to it.", status: 404 }
  if (code === '23505' || /duplicate key|unique constraint|already exists/i.test(raw))
    return { message: 'That already exists.', status: 400 }
  if ((code && (code.startsWith('22') || code.startsWith('23'))) || /invalid input|violates|invalid text representation|22\d{3}/i.test(raw))
    return { message: 'Invalid input.', status: 400 }
  return { message: 'Something went wrong. Please try again.', status: 500 }
}
