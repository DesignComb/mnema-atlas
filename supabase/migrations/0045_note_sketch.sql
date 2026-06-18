-- ════════════════════════════════════════════════════════════════════════════
-- 0045 · Sketch-as-Note: a quick whiteboard/blackboard whose drawing lives as a
-- note.
--
-- A "sketch" is just a note whose body is image markdown (![](url)) PLUS a
-- re-editable vector scene (sketch_scene). Two new columns on `notes`:
--   1) kind          — discriminator (note | sketch); drives the brush icon,
--                       the thumbnail row variant, and the Sketches lens filter.
--   2) sketch_scene   — jsonb stroke list so a saved drawing can be re-opened
--                       and kept editing (perfect-freehand strokes).
--
-- All write logic is isolated in ONE new RPC, set_note_sketch, which sets
-- body + scene + kind='sketch' atomically. create_note / update_note are left
-- COMPLETELY untouched (no overload trap), following the set_note_starred (0044)
-- convention of a dedicated toggle RPC. The image itself rides the existing
-- public `uploads` bucket + uploadImage(), so no storage / RLS changes either.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Columns ─────────────────────────────────────────────────────────────────
alter table public.notes add column if not exists kind text not null default 'note';

-- Idempotent NAMED constraint (mirrors 0040's notes_created_via_chk do-block).
do $$
begin
  alter table public.notes drop constraint if exists notes_kind_chk;
  alter table public.notes add constraint notes_kind_chk
    check (kind in ('note', 'sketch'));
end;
$$;

-- The Sketches lens filters by (user_id, kind) newest-first.
create index if not exists notes_user_kind_idx
  on public.notes (user_id, kind, updated_at desc);

alter table public.notes add column if not exists sketch_scene jsonb;

-- ── set_note_sketch ───────────────────────────────────────────────────────────
-- Persist a drawing: replace the note body (the flattened ![](url) image) and
-- the editable scene in one shot, and mark the note as a sketch. Used for both
-- the first save and every re-edit. Caps the scene blob (mirrors the
-- set_user_layout pg_column_size guard) so a runaway stroke list can't bloat the
-- row — generous (1 MB) because a real drawing has thousands of points.
create or replace function public.set_note_sketch(
  p_user_id uuid,
  p_note_id uuid,
  p_body text,
  p_scene jsonb default null
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
  if p_scene is not null and jsonb_typeof(p_scene) <> 'object' then
    raise exception 'scene must be a json object' using errcode = '23514';
  end if;
  if p_scene is not null and pg_column_size(p_scene) > 1048576 then
    raise exception 'drawing too large' using errcode = '23514';
  end if;
  update public.notes
     set body         = coalesce(p_body, ''),
         sketch_scene = p_scene,
         kind         = 'sketch'
   where id = p_note_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.set_note_sketch(uuid,uuid,text,jsonb) from public;
grant execute on function public.set_note_sketch(uuid,uuid,text,jsonb) to authenticated, service_role;

-- Supabase default privileges re-grant EXECUTE to PUBLIC/anon on every new
-- function — re-revoke and re-grant only the one legitimately anon-callable one.
revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
