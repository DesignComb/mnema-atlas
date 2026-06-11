# Known issues

Bugs found in the wild that we haven't fixed yet. Delete the entry when fixed.

## 1. MCP list tools return spec-violating `structuredContent` (arrays) — breaks strict clients

**Found:** 2026-06-11, by Claude Code's MCP client rejecting `list_captures` with
`invalid_type: expected record, received array` at path `structuredContent`.

**Cause:** `worker/src/mcp.ts:42` passes `result.data` straight through as
`structuredContent`. The MCP spec requires `structuredContent` to be a JSON **object**,
but every list/bulk tool returns a bare **array** (`data: rows`) — 19 sites in
`worker/src/tools.ts` (`list_captures`, `list_notes`, `list_cards`, `list_itineraries`,
`list_transactions`, `search_transactions`, `list_subscriptions`, `list_health_logs`,
`list_journal_entries`, `list_medications`, `list_recipes`, `list_pantry`,
`list_shopping`, `list_meal_plans`, `create_bookings_bulk`, `create_checklist_bulk`,
`create_transactions_bulk`, `add_shopping_items`, `get_upcoming_subscriptions`).
Lenient clients tolerated it; strict ones (current Claude Code) validate and the whole
tool call fails — the inbox-triage flow via MCP is dead until fixed.

**Suggested fix (single point):** in `mcp.ts`, wrap arrays:
`structuredContent: Array.isArray(result.data) ? { items: result.data } : result.data`.
Check whether any other consumer reads `result.data`'s shape (REST layer builds its own
responses, but verify) and whether tools declare an `outputSchema` that must match.

**Workaround used meanwhile:** query the table directly via the Supabase Management API
(`/database/query`, `sbp_` token — see scripts/apply-migrations.mjs for the pattern).

## 2. `create_note` response omits the tags it just applied (cosmetic)

`worker/src/tools.ts:196-205`: the tool creates the note, then calls `set_note_tags`
when `tags` were passed — but returns the row captured **before** the tags RPC, so the
response shows `"tags": []` even though the tags were written. Misleads AI callers into
issuing a redundant `set_note_tags`. Fix: re-read the note (or merge `a.tags` into the
returned row) after the tags call.
