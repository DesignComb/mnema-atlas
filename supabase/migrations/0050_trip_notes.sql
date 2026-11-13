-- ════════════════════════════════════════════════════════════════════════════
-- 0050 · Trip notes (備忘錄) — iCloud-Notes-style shared notes per trip.
--
-- Each trip gets any number of markdown notes that the owner + editors can
-- write and viewers can read. Mirrors trip_bookings / trip_checklist (0013):
-- owner_id = the trip owner (quota + cascade), created_by / updated_by = the
-- actual actor, membership-aware SELECT, writes via RPC only.
--
-- "Take turns" collaboration: update_trip_note takes an optional
-- p_expected_updated_at. When it no longer matches the row, the RPC raises
-- 'conflict' (40001) instead of silently overwriting a collaborator's edit;
-- the UI then offers reload / overwrite. Omit it (AI tools) for last-write-wins.
--
-- Not exposed through get_shared_itinerary — notes often hold passport /
-- booking numbers, so public share links never include them.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.trip_notes (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  created_by   uuid references auth.users(id) on delete set null,
  updated_by   uuid references auth.users(id) on delete set null,
  title        text not null default '',
  body         text not null default '',
  pinned       boolean not null default false,
  created_via  text not null default 'ui' check (created_via in ('ui', 'rest', 'mcp')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint trip_note_title_len check (char_length(title) <= 300),
  constraint trip_note_body_len  check (char_length(body) <= 100000)
);
create index if not exists trip_notes_itin_idx  on public.trip_notes (itinerary_id, pinned desc, updated_at desc);
create index if not exists trip_notes_owner_idx on public.trip_notes (owner_id);

drop trigger if exists trip_notes_updated_at on public.trip_notes;
create trigger trip_notes_updated_at before update on public.trip_notes
  for each row execute function app.set_updated_at();
drop trigger if exists trip_notes_quota on public.trip_notes;
create trigger trip_notes_quota before insert on public.trip_notes
  for each row execute function app.enforce_row_quota('5000', 'owner_id');

-- ── RLS: membership-aware SELECT; no write policies (RPC only) ──
alter table public.trip_notes enable row level security;
drop policy if exists trip_notes_select on public.trip_notes;
create policy trip_notes_select on public.trip_notes for select to authenticated
  using ((select auth.uid()) = owner_id or app.can_access_itinerary(itinerary_id, (select auth.uid()), false));

-- ── JSON shape shared by list + write RPCs (adds the editors' display names) ──
create or replace function app.trip_note_json(n public.trip_notes)
returns jsonb language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'itinerary_id', n.itinerary_id, 'title', n.title, 'body', n.body,
    'pinned', n.pinned, 'created_via', n.created_via,
    'created_by', n.created_by, 'updated_by', n.updated_by,
    'created_by_name', (select p.display_name from public.profiles p where p.id = n.created_by),
    'updated_by_name', (select p.display_name from public.profiles p where p.id = n.updated_by),
    'created_at', n.created_at, 'updated_at', n.updated_at)
$$;
revoke all on function app.trip_note_json(public.trip_notes) from public;
grant execute on function app.trip_note_json(public.trip_notes) to authenticated, service_role;

-- ── RPCs ──
create or replace function public.list_trip_notes(p_user_id uuid, p_itinerary_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id);
begin
  if not app.can_access_itinerary(p_itinerary_id, v_actor, false) then
    raise exception 'itinerary not found' using errcode = 'P0002';
  end if;
  return coalesce((
    select jsonb_agg(app.trip_note_json(n) order by n.pinned desc, n.updated_at desc)
      from public.trip_notes n where n.itinerary_id = p_itinerary_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.create_trip_note(
  p_user_id uuid, p_itinerary_id uuid, p_title text default '', p_body text default '',
  p_pinned boolean default false, p_created_via text default 'ui'
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_owner uuid; v_row public.trip_notes;
begin
  select owner_id into v_owner from public.itineraries where id = p_itinerary_id;
  if not found then raise exception 'itinerary not found' using errcode = 'P0002'; end if;
  if not app.can_access_itinerary(p_itinerary_id, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.trip_notes (itinerary_id, owner_id, created_by, updated_by, title, body, pinned, created_via)
  values (p_itinerary_id, v_owner, v_actor, v_actor, coalesce(p_title, ''), coalesce(p_body, ''),
          coalesce(p_pinned, false), coalesce(p_created_via, 'ui'))
  returning * into v_row;
  return app.trip_note_json(v_row);
end;
$$;

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
    raise exception 'conflict' using errcode = '40001',
      detail = 'This note was changed by someone else since you opened it.';
  end if;
  update public.trip_notes set
    title = coalesce(p_title, title), body = coalesce(p_body, body),
    pinned = coalesce(p_pinned, pinned), updated_by = v_actor
  where id = p_note_id returning * into v_row;
  return app.trip_note_json(v_row);
end;
$$;

create or replace function public.delete_trip_note(p_user_id uuid, p_note_id uuid)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid := app.resolve_uid(p_user_id); v_itin uuid; v_n int;
begin
  select itinerary_id into v_itin from public.trip_notes where id = p_note_id;
  if v_itin is null then return false; end if;
  if not app.can_access_itinerary(v_itin, v_actor, true) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.trip_notes where id = p_note_id;
  get diagnostics v_n = row_count; return v_n > 0;
end;
$$;

-- ── Grants + anon re-hardening ──
do $$
declare f text;
begin
  foreach f in array array[
    'public.list_trip_notes(uuid,uuid)',
    'public.create_trip_note(uuid,uuid,text,text,boolean,text)',
    'public.update_trip_note(uuid,uuid,text,text,boolean,timestamptz)',
    'public.delete_trip_note(uuid,uuid)'
  ]
  loop
    execute format('revoke all on function %s from public;', f);
    execute format('grant execute on function %s to authenticated, service_role;', f);
  end loop;
end;
$$;

revoke execute on all functions in schema public from anon;
grant execute on function public.get_shared_itinerary(text) to anon;

-- ── Realtime: collaborators see each other's saves live (best-effort) ──
do $$
begin
  alter publication supabase_realtime add table public.trip_notes;
exception when others then null;
end;
$$;
