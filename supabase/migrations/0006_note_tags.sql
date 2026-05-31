-- ════════════════════════════════════════════════════════════════════════
-- 0006 — Lightweight tags on notes.
-- A `text[]` column (not a join table) keeps it simple: multi-label, no extra
-- round-trips, and colours are derived deterministically from the tag name on
-- the client (see src/lib/tags.ts). Tags drive the graph's colours + clusters.
-- ════════════════════════════════════════════════════════════════════════

alter table public.notes
  add column if not exists tags text[] not null default '{}';

create index if not exists notes_tags_idx on public.notes using gin (tags);

-- Replace the whole tag set on a note (owner-scoped, shared write path).
create or replace function public.set_note_tags(
  p_user_id uuid,
  p_note_id uuid,
  p_tags text[]
)
returns public.notes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
  v_row public.notes;
  v_clean text[];
begin
  -- normalise: trim, drop blanks, de-dupe, cap length & count.
  select array(
    select distinct left(trim(t), 40)
      from unnest(coalesce(p_tags, '{}')) as t
     where trim(t) <> ''
     limit 12
  ) into v_clean;

  update public.notes
     set tags = v_clean
   where id = p_note_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array['public.set_note_tags(uuid,uuid,text[])']
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

-- get_graph now carries each note's tags so the graph can colour / cluster by them.
create or replace function public.get_graph(p_user_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := app.resolve_uid(p_user_id);
begin
  return jsonb_build_object(
    'nodes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', n.id, 'title', n.title, 'deck_id', n.deck_id, 'tags', n.tags))
        from public.notes n where n.user_id = v_uid), '[]'::jsonb),
    'edges', coalesce((
      select jsonb_agg(jsonb_build_object(
               'source', l.source_note_id, 'target', l.target_note_id,
               'type', l.link_type, 'weight', l.weight))
        from public.note_links l where l.user_id = v_uid), '[]'::jsonb)
  );
end;
$$;
