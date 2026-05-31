-- ════════════════════════════════════════════════════════════════════════
-- 0007 — Tags on flashcards too (so you can study by tag).
-- Mirrors the note tags from 0006: a text[] column + a set_card_tags RPC.
-- ════════════════════════════════════════════════════════════════════════

alter table public.cards
  add column if not exists tags text[] not null default '{}';

create index if not exists cards_tags_idx on public.cards using gin (tags);

create or replace function public.set_card_tags(
  p_user_id uuid,
  p_card_id uuid,
  p_tags text[]
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.cards;
  v_clean text[];
begin
  select array(
    select distinct left(trim(t), 40)
      from unnest(coalesce(p_tags, '{}')) as t
     where trim(t) <> ''
     limit 12
  ) into v_clean;

  update public.cards
     set tags = v_clean
   where id = p_card_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.set_card_tags(uuid,uuid,text[])']
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;
