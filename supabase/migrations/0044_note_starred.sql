-- ════════════════════════════════════════════════════════════════════════════
-- 0044 · Star a note.
--
-- notes.starred + a dedicated toggle RPC (set_task_url convention — keeps the
-- create_note/update_note signatures untouched). The notes list pins starred
-- notes in their own section.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.notes add column if not exists starred boolean not null default false;

create or replace function public.set_note_starred(
  p_user_id uuid,
  p_note_id uuid,
  p_starred boolean
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
  update public.notes
     set starred = coalesce(p_starred, false)
   where id = p_note_id and user_id = v_uid
  returning * into v_row;
  if not found then
    raise exception 'note not found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────────
revoke all on function public.set_note_starred(uuid,uuid,boolean) from public;
grant execute on function public.set_note_starred(uuid,uuid,boolean) to authenticated, service_role;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;
