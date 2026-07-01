-- ════════════════════════════════════════════════════════════════════════════
-- 0049 · Mark a flashcard "important" (重要) — priority review.
--
-- cards.starred + a dedicated toggle RPC (mirrors set_note_starred, 0044 —
-- keeps the create_card/update_card signatures untouched). Important cards
-- surface first in the due queue and can be reviewed on their own. Reuses the
-- same "starred" concept as notes so the mental model is one flag, not two.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.cards add column if not exists starred boolean not null default false;

-- Partial index: the "important only" review queue reads just the starred rows.
create index if not exists cards_starred_idx on public.cards (user_id, due) where starred;

create or replace function public.set_card_starred(
  p_user_id uuid,
  p_card_id uuid,
  p_starred boolean
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.cards;
begin
  update public.cards
     set starred = coalesce(p_starred, false)
   where id = p_card_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.set_card_starred(uuid,uuid,boolean) from public;
grant execute on function public.set_card_starred(uuid,uuid,boolean) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
