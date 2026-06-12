-- ════════════════════════════════════════════════════════════════════════════
-- 0043 · set_deck_parent cycle-guard hardening.
--
-- Two issues in 0040's guard:
--   1. UNION ALL in the ancestor walk never terminates if a cycle somehow
--      already exists in the data (each lap re-adds the same rows). UNION
--      deduplicates, so the recursion is guaranteed to stop.
--   2. Check-then-act: two concurrent moves (A under B, B under A) could each
--      pass the guard then both commit, creating the very cycle the guard
--      exists to prevent. Locking the two decks' rows (FOR UPDATE, ordered by
--      id to avoid deadlock) serializes concurrent moves for the same user.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.set_deck_parent(
  p_user_id uuid,
  p_deck_id uuid,
  p_parent_deck_id uuid default null
)
returns public.decks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.decks;
begin
  -- Serialize concurrent re-parents touching these decks (ordered to avoid deadlock).
  perform 1 from public.decks
   where user_id = v_uid and id in (p_deck_id, p_parent_deck_id)
   order by id
     for update;

  if p_parent_deck_id is not null then
    if p_parent_deck_id = p_deck_id then
      raise exception 'a deck cannot be its own parent' using errcode = '23514';
    end if;
    if not exists (select 1 from public.decks where id = p_parent_deck_id and user_id = v_uid) then
      raise exception 'parent deck not found' using errcode = 'P0002';
    end if;
    -- Cycle guard: the new parent must not sit anywhere below the deck being
    -- moved. Walk up from the new parent; hitting p_deck_id means a cycle.
    -- UNION (not UNION ALL): dedup guarantees termination even on corrupt data.
    if exists (
      with recursive anc as (
        select d.id, d.parent_deck_id
          from public.decks d
         where d.id = p_parent_deck_id and d.user_id = v_uid
        union
        select d.id, d.parent_deck_id
          from public.decks d
          join anc on d.id = anc.parent_deck_id
         where d.user_id = v_uid
      )
      select 1 from anc where anc.id = p_deck_id
    ) then
      raise exception 'cannot move a deck inside its own sub-deck' using errcode = '23514';
    end if;
  end if;
  update public.decks
     set parent_deck_id = p_parent_deck_id
   where id = p_deck_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.set_deck_parent(uuid,uuid,uuid) from public;
grant execute on function public.set_deck_parent(uuid,uuid,uuid) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
