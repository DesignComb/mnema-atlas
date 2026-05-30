# Mnema Atlas — App Review Action Plan

_From a 5-agent review (onboarding, page consolidation, missing features, code optimization), 2026-05-30._

## DONE (shipped, commit c97c2d8, live)
1. **Welcome hero** for empty libraries (home) — replaced the false "All caught up, come back later".
2. **One-click "Add a sample deck"** → seeds 1 note + 3 due cards → drops into Study (home + Cards empty state). `src/lib/sampleDeck.ts`, `useSeedSample()`.
3. **Consolidated** Keys + Connect + Tools → **`/settings/integrations`** (one page; setup snippets now fill in the *real* minted key, not `mk_your_key`). Old routes 301→ integrations. Guide slimmed.
4. **Nav/jargon**: pinned "How it works" in the sidebar; collapsed user menu (Import / Connect / Sign out); "Connect an AI" in ⌘K; removed raw "MCP" from first-run copy; platform-correct `⌘`/`Ctrl` (`modKey`).
5. **Code-split** routes (lazy note/study/graph/guide/integrations) → main JS chunk **1,695 kB → 945 kB**.
   Plus: global Claude Code safety hooks (`permissions.deny` rm -rf catastrophes) + completion bell.

## NEXT — Missing features (ranked; the first two are TRUE BLOCKERS)
6. **Edit / delete a flashcard** — AI makes imperfect cards and there is NO way to fix or delete any card. Needs migration `0004` (`update_card` + `delete_card` RPCs, GRANTs), `api.ts`/`hooks.ts`, generalize `NewCardDialog` to edit, add edit tool to `worker/src/tools.ts` (`requiresScope:'edit'`) + `shared/schemas.ts`. **L**
7. **Delete a note / deck** — every stray "New note" click leaves a permanent "Untitled". Needs `delete_note`/`delete_deck` RPCs + confirm dialogs. **M**
8. Re-file card/note to another deck (frontend-only after #6). **S**
9. Wire `search_notes` RPC into ⌘K (today: client-side, title-only, capped at 12). **M**
10. Mobile/responsive layout (sidebar → slide-over below md). **M**
11. Drop the unused `tags`/`note_tags` schema (fold into the #6 migration). **S**
12. Cram/study-ahead + surface review-save failures. **M**
13. Profile display-name + data export. **M**

## NEXT — Code optimization
16. Wire `<Database>` generic into both Supabase clients → drop the `as never`/`as unknown` casts + manual return-type annotations. **S** (do before #6–#9).
17. Extract a shared `<FlashcardTile>` (triplicated in deck/cards/note). **S**
18. `useRecordReview` hook (fix stale `cards-by-note` after study) + dedup `newNote` (now `useNewNote`, partly done). **S**
19. Worker: memoize `serviceClient`; route `get_note` through the shared RPC path. **S**
20. Don't leak raw Postgres error messages to REST/MCP clients; a11y sweep; shared `formatDuration`. **S–M**

**Suggested order:** #16 → migration batch #6/#7/#11 + #17 → #8/#9/#18 → #10 → rest.
