-- ════════════════════════════════════════════════════════════════════════════
-- 0040 · Note provenance + deck re-parenting.
--
-- 1) notes.created_via — notes were the only content table without provenance;
--    create_note has accepted p_created_via since 0001 but silently discarded
--    it. Adding the column (cards' check-constraint convention) lets the UI
--    render the AI chip on notes (QW10 gap).
-- 2) set_deck_parent — decks.parent_deck_id has existed since 0001 (with index
--    + ON DELETE SET NULL) and create_deck accepts it, but nothing could
--    re-parent an existing deck. Follows the set_note_deck convention: the
--    parameter is assigned directly, so null genuinely moves a deck to the top
--    level. Cycle-guarded (a deck can't move under its own descendant).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) notes.created_via ──────────────────────────────────────────────────────
alter table public.notes add column if not exists created_via text not null default 'ui';
do $$
begin
  alter table public.notes drop constraint if exists notes_created_via_chk;
  alter table public.notes add constraint notes_created_via_chk
    check (created_via in ('ui', 'rest', 'mcp'));
end;
$$;

create or replace function public.create_note(
  p_user_id uuid,
  p_title text,
  p_body text default '',
  p_deck_id uuid default null,
  p_created_via text default 'ui'
)
returns public.notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.notes;
begin
  if p_deck_id is not null
     and not exists (select 1 from public.decks where id = p_deck_id and user_id = v_uid) then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  insert into public.notes (user_id, title, body, deck_id, created_via)
  values (v_uid, p_title, coalesce(p_body, ''), p_deck_id, coalesce(p_created_via, 'ui'))
  returning * into v_row;
  return v_row;
end;
$$;

-- ── 2) set_deck_parent ────────────────────────────────────────────────────────
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
  if p_parent_deck_id is not null then
    if p_parent_deck_id = p_deck_id then
      raise exception 'a deck cannot be its own parent' using errcode = '23514';
    end if;
    if not exists (select 1 from public.decks where id = p_parent_deck_id and user_id = v_uid) then
      raise exception 'parent deck not found' using errcode = 'P0002';
    end if;
    -- Cycle guard: the new parent must not sit anywhere below the deck being
    -- moved. Walk up from the new parent; hitting p_deck_id means a cycle.
    if exists (
      with recursive anc as (
        select d.id, d.parent_deck_id
          from public.decks d
         where d.id = p_parent_deck_id and d.user_id = v_uid
        union all
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
revoke all on function public.create_note(uuid,text,text,uuid,text) from public;
grant execute on function public.create_note(uuid,text,text,uuid,text) to authenticated, service_role;
revoke all on function public.set_deck_parent(uuid,uuid,uuid) from public;
grant execute on function public.set_deck_parent(uuid,uuid,uuid) to authenticated, service_role;

-- Supabase default privileges re-grant EXECUTE to PUBLIC/anon on every new
-- function — re-revoke and re-grant only the one legitimately anon-callable one.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
