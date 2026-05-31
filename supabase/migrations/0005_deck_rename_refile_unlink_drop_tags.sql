-- ════════════════════════════════════════════════════════════════════════
-- 0005 — Deck rename · note re-file · unlink notes · drop unused tags.
-- Same shared-write-path conventions as 0001/0004: SECURITY DEFINER,
-- search_path='' , owner-scoped via app.resolve_uid, EXECUTE granted only to
-- authenticated + service_role.
-- ════════════════════════════════════════════════════════════════════════

-- Rename / re-describe a deck. coalesce → null means "leave unchanged".
create or replace function public.update_deck(
  p_user_id uuid,
  p_deck_id uuid,
  p_name text default null,
  p_description text default null
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
  update public.decks
     set name        = coalesce(p_name, name),
         description  = coalesce(p_description, description)
   where id = p_deck_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Move a note to another deck — or out of all decks (p_deck_id = null).
-- Distinct from update_note (which coalesces deck_id, so it can never unfile);
-- here p_deck_id is assigned directly so null genuinely clears the deck.
create or replace function public.set_note_deck(
  p_user_id uuid,
  p_note_id uuid,
  p_deck_id uuid default null
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
  update public.notes
     set deck_id = p_deck_id
   where id = p_note_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Remove the association(s) between two notes (either direction, any type).
-- Returns how many links were dropped.
create or replace function public.unlink_notes(
  p_user_id uuid,
  p_a uuid,
  p_b uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_n int;
begin
  delete from public.note_links
   where user_id = v_uid
     and (
       (source_note_id = p_a and target_note_id = p_b)
       or (source_note_id = p_b and target_note_id = p_a)
     );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Lock down execution (new functions default to EXECUTE for PUBLIC).
do $$
declare f text;
begin
  foreach f in array array[
    'public.update_deck(uuid,uuid,text,text)',
    'public.set_note_deck(uuid,uuid,uuid)',
    'public.unlink_notes(uuid,uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- ── Drop the unused tags feature ─────────────────────────────────────────
-- Nothing in the UI, Worker, or API references these. note_tags first (it FKs
-- tags). Their RLS policies + indexes drop with the tables.
drop table if exists public.note_tags;
drop table if exists public.tags;
