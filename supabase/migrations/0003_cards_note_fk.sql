-- ════════════════════════════════════════════════════════════════════════
-- 0003 — Stop a deleted note from cascade-deleting its flashcards.
-- A flashcard is a durable study item; tidying/deleting its source note must
-- NOT destroy it. Flip cards.note_id from ON DELETE CASCADE → ON DELETE SET NULL
-- (keep the card, just drop the backlink). The card keeps its own deck_id.
-- ════════════════════════════════════════════════════════════════════════

alter table public.cards drop constraint cards_note_id_fkey;

alter table public.cards
  add constraint cards_note_id_fkey
  foreign key (note_id) references public.notes(id) on delete set null;
