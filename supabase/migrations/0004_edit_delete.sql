-- ════════════════════════════════════════════════════════════════════════
-- 0004 — Manual edit & delete (cards / notes / decks).
-- All through SECURITY DEFINER RPCs (the shared write path), owner-scoped via
-- app.resolve_uid. Deletes rely on the existing FKs: deleting a note SETs NULL
-- on its cards' note_id (0003) and cascades note_links; deleting a deck SETs
-- NULL on its notes'/cards' deck_id and child decks' parent_deck_id (0001).
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.update_card(
  p_user_id uuid,
  p_card_id uuid,
  p_front text default null,
  p_back text default null,
  p_deck_id uuid default null,
  p_note_id uuid default null
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
  if p_deck_id is not null
     and not exists (select 1 from public.decks where id = p_deck_id and user_id = v_uid) then
    raise exception 'deck not found' using errcode = 'P0002';
  end if;
  if p_note_id is not null
     and not exists (select 1 from public.notes where id = p_note_id and user_id = v_uid) then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  update public.cards
     set front   = coalesce(p_front, front),
         back    = coalesce(p_back, back),
         deck_id = coalesce(p_deck_id, deck_id),
         note_id = coalesce(p_note_id, note_id)
   where id = p_card_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

create or replace function public.delete_card(p_user_id uuid, p_card_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.cards where id = p_card_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.delete_note(p_user_id uuid, p_note_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.notes where id = p_note_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

create or replace function public.delete_deck(p_user_id uuid, p_deck_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.resolve_uid(p_user_id); v_n int;
begin
  delete from public.decks where id = p_deck_id and user_id = v_uid;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Lock down execution (default is EXECUTE to PUBLIC).
do $$
declare f text;
begin
  foreach f in array array[
    'public.update_card(uuid,uuid,text,text,uuid,uuid)',
    'public.delete_card(uuid,uuid)',
    'public.delete_note(uuid,uuid)',
    'public.delete_deck(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;
