-- ════════════════════════════════════════════════════════════════════════════
-- 0051 · HOTFIX: update_trip_note's conflict must not be SQLSTATE 40001.
--
-- 0050 raised the optimistic-concurrency 'conflict' as 40001
-- (serialization_failure). PostgREST's driver treats 40001 as a transient
-- error and retries the whole transaction indefinitely, so every stale save
-- became a server-side retry loop pinning a pool connection (~1 retry/s).
-- Enough of them starved the pool → PGRST002 schema-cache failures → every
-- API call 503'd (2026-11-20 08:37 UTC).
--
-- PT409 is PostgREST's custom-status SQLSTATE: HTTP 409, never retried. The
-- message stays 'conflict', so clients (isNoteConflict) are unchanged.
-- Do not use 40001 / 40P01 for application errors in any RPC.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.update_trip_note(
  p_user_id uuid, p_note_id uuid, p_title text default null, p_body text default null,
  p_pinned boolean default null, p_expected_updated_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_cur public.trip_notes; v_row public.trip_notes;
begin
  select * into v_cur from public.trip_notes where id = p_note_id for update;
  if not found then raise exception 'note not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(v_cur.itinerary_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_expected_updated_at is not null and v_cur.updated_at <> p_expected_updated_at then
    raise exception 'conflict' using errcode = 'PT409',
      detail = 'This note was changed by someone else since you opened it.';
  end if;
  update public.trip_notes set
    title = coalesce(p_title, title), body = coalesce(p_body, body),
    pinned = coalesce(p_pinned, pinned), updated_by = v_actor
  where id = p_note_id returning * into v_row;
  return app.trip_note_json(v_row);
end;
$$;

revoke all on function public.update_trip_note(uuid,uuid,text,text,boolean,timestamptz) from public;
grant execute on function public.update_trip_note(uuid,uuid,text,text,boolean,timestamptz) to authenticated, service_role;
